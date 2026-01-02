const EngineState = {
            seed: "QUANTUM-7",
            resolution: 96,
            noiseScale: 1.2,
            roughness: 1.5,
            seaLevel: 0.45,
            riverDensity: 40,
            radius: 1.6
        };

        /**
         * NOISE MODULE
         * High-performance 3D Fractal Noise
         */
        class NoiseEngine {
            constructor(seed) {
                this.p = new Uint8Array(512);
                const random = this.getSeededRandom(seed);
                const values = Array.from({length: 256}, (_, i) => i);
                for(let i = 255; i > 0; i--) {
                    const r = Math.floor(random() * (i + 1));
                    [values[i], values[r]] = [values[r], values[i]];
                }
                for(let i = 0; i < 512; i++) this.p[i] = values[i % 256];
            }

            getSeededRandom(seed) {
                let h = 2166136261 >>> 0;
                for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
                return () => {
                    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
                    return (h >>> 0) / 4294967296;
                };
            }

            fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
            lerp(t, a, b) { return a + t * (b - a); }
            grad(hash, x, y, z) {
                const h = hash & 15;
                const u = h < 8 ? x : y;
                const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
                return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
            }

            sample(x, y, z) {
                const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
                x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
                const u = this.fade(x), v = this.fade(y), w = this.fade(z);
                const A = this.p[X]+Y, AA = this.p[A]+Z, AB = this.p[A+1]+Z;
                const B = this.p[X+1]+Y, BA = this.p[B]+Z, BB = this.p[B+1]+Z;
                return this.lerp(w, 
                    this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x-1, y, z)),
                               this.lerp(u, this.grad(this.p[AB], x, y-1, z), this.grad(this.p[BB], x-1, y-1, z))),
                    this.lerp(v, this.lerp(u, this.grad(this.p[AA+1], x, y, z-1), this.grad(this.p[BA+1], x-1, y, z-1)),
                               this.lerp(u, this.grad(this.p[AB+1], x, y-1, z-1), this.grad(this.p[BB+1], x-1, y-1, z-1))));
            }

            fbm(x, y, z, octaves = 6, persistence = 0.5) {
                let total = 0, freq = 1, amp = 1, maxAmp = 0;
                for(let i=0; i<octaves; i++) {
                    total += this.sample(x * freq, y * freq, z * freq) * amp;
                    maxAmp += amp;
                    amp *= persistence;
                    freq *= 2.0;
                }
                return (total / maxAmp + 1) / 2;
            }
        }

        /**
         * CLIMATE & BIOME MODULE
         * Handles temperature and moisture classification
         */
        class ClimateSystem {
            static getBiomeColor(height, latitude, moisture, seaLevel) {
                const temp = 1.0 - (height * 0.4 + latitude * 0.6); // Altitude + Latitudinal cooling
                
                if (height < seaLevel) {
                    return height < seaLevel - 0.15 ? new THREE.Color('#081e36') : new THREE.Color('#0ea5e9'); // Depth shading
                }

                // Snow & Ice caps
                if (latitude > 0.88 || (height > 0.85 && latitude > 0.6)) return new THREE.Color('#f8fafc');
                
                // High Mountains
                if (height > 0.82) return new THREE.Color('#64748b');

                // Coastlines
                if (height < seaLevel + 0.02) return new THREE.Color('#fde047');

                // Whittaker-style Biome Mapping
                if (temp > 0.8) {
                    return moisture > 0.6 ? new THREE.Color('#064e3b') : moisture > 0.3 ? new THREE.Color('#166534') : new THREE.Color('#d97706'); 
                } else if (temp > 0.5) {
                    return moisture > 0.5 ? new THREE.Color('#15803d') : new THREE.Color('#84cc16');
                } else {
                    return moisture > 0.4 ? new THREE.Color('#3f6212') : new THREE.Color('#94a3b8');
                }
            }
        }

        /**
         * HYDROLOGY MODULE
         * River flow accumulation logic
         */
        class RiverSystem {
            constructor(vertexCount, noiseEngine) {
                this.vertexCount = vertexCount;
                this.noise = noiseEngine;
            }

            simulate(positions, heights, density, seaLevel, prng) {
                const rivers = new Set();
                if (density <= 0) return rivers;

                const iterations = density * 2;
                for (let i = 0; i < iterations; i++) {
                    let currIdx = Math.floor(prng() * this.vertexCount);
                    if (heights[currIdx] < seaLevel + 0.1) continue;

                    for (let step = 0; step < 100; step++) {
                        rivers.add(currIdx);
                        let bestNeighbor = currIdx;
                        let minH = heights[currIdx];

                        // Find steepest descent
                        for (let n = 0; n < 12; n++) {
                            const neighbor = (currIdx + Math.floor(prng() * 150)) % this.vertexCount;
                            if (heights[neighbor] < minH) {
                                minH = heights[neighbor];
                                bestNeighbor = neighbor;
                            }
                        }

                        if (bestNeighbor === currIdx || heights[bestNeighbor] < seaLevel) break;
                        currIdx = bestNeighbor;
                    }
                }
                return rivers;
            }
        }

        /**
         * RENDERER MODULE
         * Three.js Scene Bridge
         */
        class PlanetRenderer {
            constructor(containerId) {
                this.container = document.getElementById(containerId);
                this.scene = new THREE.Scene();
                this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
                this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                this.container.appendChild(this.renderer.domElement);

                this.camera.position.z = 6;
                this.isPaused = false;

                this.setupEnvironment();
                this.setupInteractions();
                window.addEventListener('resize', () => this.handleResize());
            }

            setupEnvironment() {
                this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
                const sun = new THREE.DirectionalLight(0xffffff, 1.2);
                sun.position.set(10, 5, 10);
                this.scene.add(sun);

                // Stars
                const stars = new THREE.BufferGeometry();
                const starPoints = [];
                for(let i=0; i<6000; i++) starPoints.push((Math.random()-0.5)*200, (Math.random()-0.5)*200, (Math.random()-0.5)*200);
                stars.setAttribute('position', new THREE.Float32BufferAttribute(starPoints, 3));
                this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x888888, size: 0.05 })));
            }

            setupInteractions() {
                let dragging = false, px = 0, py = 0;
                this.container.addEventListener('mousedown', (e) => { dragging = true; px = e.clientX; py = e.clientY; });
                window.addEventListener('mouseup', () => dragging = false);
                window.addEventListener('mousemove', (e) => {
                    if(!dragging || !this.planetMesh) return;
                    this.planetMesh.rotation.y += (e.clientX - px) * 0.005;
                    this.planetMesh.rotation.x += (e.clientY - py) * 0.005;
                    px = e.clientX; py = e.clientY;
                });
                this.container.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    this.camera.position.z = Math.min(15, Math.max(2.5, this.camera.position.z + e.deltaY * 0.005));
                }, { passive: false });
            }

            handleResize() {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            }

            renderPlanet(config, prng) {
                if(this.planetMesh) this.scene.remove(this.planetMesh);
                if(this.atmosphere) this.scene.remove(this.atmosphere);

                const noise = new NoiseEngine(config.seed);
                const hydrology = new RiverSystem(0, noise);
                
                const geo = new THREE.IcosahedronGeometry(config.radius, config.resolution);
                const pos = geo.attributes.position;
                const colors = new Float32Array(pos.count * 3);
                
                const heights = new Float32Array(pos.count);
                const moistures = new Float32Array(pos.count);

                // Pass 1: Heightmap Logic
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
                    const h = noise.fbm(x * config.noiseScale, y * config.noiseScale, z * config.noiseScale, 7, 0.5);
                    const lat = Math.abs(y / config.radius);
                    const m = noise.fbm(x * 0.7, y * 0.7, z * 0.7, 4, 0.5);

                    heights[i] = h;
                    moistures[i] = m;
                }

                // Pass 2: Rivers Logic
                hydrology.vertexCount = pos.count;
                const riverIndices = hydrology.simulate(pos, heights, config.riverDensity, config.seaLevel, prng);

                // Pass 3: Geometry Transformation & Coloring
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
                    const h = heights[i];
                    const lat = Math.abs(y / config.radius);

                    // Deform vertices based on JS logic
                    const isLand = h > config.seaLevel;
                    const offset = isLand ? (h - config.seaLevel) * 0.6 * config.roughness : 0;
                    const normal = new THREE.Vector3(x, y, z).normalize();
                    pos.setXYZ(i, x + normal.x * offset, y + normal.y * offset, z + normal.z * offset);

                    // Color based on Climate logic
                    const color = riverIndices.has(i) ? new THREE.Color('#38bdf8') : ClimateSystem.getBiomeColor(h, lat, moistures[i], config.seaLevel);
                    colors[i*3] = color.r; colors[i*3+1] = color.g; colors[i*3+2] = color.b;
                }

                geo.computeVertexNormals();
                geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                
                this.planetMesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 10, flatShading: config.resolution < 80 }));
                this.scene.add(this.planetMesh);

                // Atmosphere
                const atmoGeo = new THREE.SphereGeometry(config.radius * 1.06, 64, 64);
                this.atmosphere = new THREE.Mesh(atmoGeo, new THREE.MeshPhongMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.08, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
                this.scene.add(this.atmosphere);

                document.getElementById('hud-verts').textContent = pos.count.toLocaleString();
                document.getElementById('hud-rivers').textContent = riverIndices.size.toLocaleString();
            }

            animate() {
                requestAnimationFrame(() => this.animate());
                if (!this.isPaused && this.planetMesh) this.planetMesh.rotation.y += 0.001;
                this.renderer.render(this.scene, this.camera);
            }
        }

        /**
         * APP BOOTSTRAP
         */
        const App = {
            init() {
                this.renderer = new PlanetRenderer('canvas-wrap');
                this.setupUI();
                this.generate();
                this.renderer.animate();

                setTimeout(() => {
                    document.getElementById('loader').style.opacity = '0';
                    setTimeout(() => document.getElementById('loader').style.display = 'none', 500);
                }, 1500);
            },

            setupUI() {
                const els = {
                    seed: 'seed-input', detail: 'detail-slider', scale: 'scale-slider', 
                    rough: 'rough-slider', sea: 'sea-slider', river: 'river-slider',
                    btn: 'generate-btn', rand: 'random-seed', pause: 'play-pause',
                    theme: 'theme-toggle', shot: 'snapshot'
                };
                this.nodes = {};
                for(let k in els) this.nodes[k] = document.getElementById(els[k]);

                this.nodes.btn.onclick = () => {
                    this.updateState();
                    this.generate();
                };

                this.nodes.rand.onclick = () => {
                    this.nodes.seed.value = "ASTRO-" + Math.floor(Math.random()*99999).toString(16).toUpperCase();
                    this.updateState();
                    this.generate();
                };

                this.nodes.pause.onclick = () => {
                    this.renderer.isPaused = !this.renderer.isPaused;
                    this.nodes.pause.textContent = this.renderer.isPaused ? "Resume Spin" : "Pause Spin";
                };

                this.nodes.theme.onclick = () => {
                    const current = document.body.getAttribute('data-theme');
                    document.body.setAttribute('data-theme', current === 'light' ? 'dark' : 'light');
                };

                this.nodes.shot.onclick = () => {
                    const link = document.createElement('a');
                    link.download = `AstroGen_${this.nodes.seed.value}.png`;
                    link.href = this.renderer.renderer.domElement.toDataURL("image/png");
                    link.click();
                };

                // Real-time Label sync
                ['detail', 'scale', 'rough', 'sea', 'river'].forEach(key => {
                    this.nodes[key].oninput = (e) => {
                        document.getElementById(key + '-val').textContent = e.target.value;
                    };
                });
            },

            updateState() {
                EngineState.seed = this.nodes.seed.value;
                EngineState.resolution = parseInt(this.nodes.detail.value);
                EngineState.noiseScale = parseFloat(this.nodes.scale.value);
                EngineState.roughness = parseFloat(this.nodes.rough.value);
                EngineState.seaLevel = parseFloat(this.nodes.sea.value);
                EngineState.riverDensity = parseInt(this.nodes.river.value);
            },

            generate() {
                const prng = new NoiseEngine(EngineState.seed).getSeededRandom(EngineState.seed);
                this.renderer.renderPlanet(EngineState, prng);
            }
        };

        window.onload = () => App.init();
