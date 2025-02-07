// ==================================================
// Project Imports
// ==================================================

// App.jsx
import React, { useEffect, useRef, useState, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';


// ==================================================
// Main App Component with Three.js Scene
// ==================================================

const App = () => {
  const mountRef = useRef(null);
  const [gameState, setGameState] = useState('title');
  const [showInventory, setShowInventory] = useState(false);
  const sceneRef = useRef(null);
  const grassModelRef = useRef(null);
  const controlsRef = useRef(null);
  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const prevTime = useRef(performance.now());
  const blockPositions = useRef(new Set());
  const playerHeight = 1.8;
  const playerRadius = 0.3;
  // Terrain generation parameters
  const CHUNK_SIZE = 16;
  const WORLD_SIZE = 2; // Number of chunks in each direction
  
  const loadGrassModel = () => {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        'https://play.rosebud.ai/assets/grass.glb?EofL',
        (gltf) => {
          grassModelRef.current = gltf.scene.children[0];
          resolve(grassModelRef.current);
        },
        undefined,
        reject
      );
    });
  };
  const generateTerrain = (scene, grassModel) => {
    // Simplex noise for terrain generation
    const noise = (x, z) => {
      return Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;
    };
    // Generate terrain chunks
    for (let chunkX = -WORLD_SIZE; chunkX < WORLD_SIZE; chunkX++) {
      for (let chunkZ = -WORLD_SIZE; chunkZ < WORLD_SIZE; chunkZ++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldZ = chunkZ * CHUNK_SIZE + z;
            const height = Math.round(noise(worldX, worldZ));
            const block = grassModel.clone();
            block.position.set(worldX, height, worldZ);
            block.scale.set(0.5, 0.5, 0.5);
            scene.add(block);
            // Store block position for collision detection
            blockPositions.current.add(`${worldX},${height},${worldZ}`);
          }
        }
      }
    }
  };
  useEffect(() => {
    if (gameState !== 'playing') return;
    // Collision detection function - declare first
    const checkCollision = (position) => {
      if (!position) return false;
      // Check surrounding blocks for collision
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            const blockX = Math.round(position.x + x);
            const blockY = Math.round(position.y + y);
            const blockZ = Math.round(position.z + z);
            
            const key = `${blockX},${blockY},${blockZ}`;
            if (blockPositions.current.has(key)) {
              // Calculate distance between player and block center
              const dx = position.x - blockX;
              const dy = position.y - blockY;
              const dz = position.z - blockZ;
              
              // Check if within collision bounds
              if (Math.abs(dx) < (playerRadius + 0.5) &&
                  Math.abs(dy) < (playerHeight + 0.5) &&
                  Math.abs(dz) < (playerRadius + 0.5)) {
                return true; // Collision detected
              }
            }
          }
        }
      }
      return false; // No collision
    };
    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 0);
    
    // Initialize controls
    const controls = new PointerLockControls(camera, document.body);
    controlsRef.current = controls;
    
    // Handle keyboard controls
    const onKeyDown = (event) => {
      switch (event.code) {
        case 'KeyW':
          moveForward.current = true;
          break;
        case 'KeyS':
          moveBackward.current = true;
          break;
        case 'KeyA':
          moveLeft.current = true;
          break;
        case 'KeyD':
          moveRight.current = true;
          break;
        case 'KeyE':
          if (gameState === 'playing') {
            setShowInventory(prev => !prev);
            if (!showInventory) {
              controls.unlock();
            } else {
              controls.lock();
            }
          }
          break;
      }
    };
    const onKeyUp = (event) => {
      switch (event.code) {
        case 'KeyW':
          moveForward.current = false;
          break;
        case 'KeyS':
          moveBackward.current = false;
          break;
        case 'KeyA':
          moveLeft.current = false;
          break;
        case 'KeyD':
          moveRight.current = false;
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    controls.addEventListener('lock', () => {
      if (showInventory) {
        setShowInventory(false);
      }
    });
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    // Handle window resizing
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelRatio = window.devicePixelRatio;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      
      renderer.setSize(width, height);
      renderer.setPixelRatio(pixelRatio);
      
      // Update camera position to maintain cube visibility
      camera.position.z = 5;
    };
    
    // Initial setup
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    handleResize(); // Call once to set initial dimensions
    window.addEventListener('resize', handleResize);
    
    // Set up scene lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
    // Load grass model and generate terrain
    // Declare animation function before using it
    const animate = () => {
      if (!sceneRef.current) return;
      requestAnimationFrame(animate);
      
      if (controlsRef.current?.isLocked) {
        const time = performance.now();
        const delta = (time - prevTime.current) / 1000;
        
        velocity.current.x -= velocity.current.x * 10.0 * delta;
        velocity.current.z -= velocity.current.z * 10.0 * delta;
        
        direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
        direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
        direction.current.normalize();
        
        if (moveForward.current || moveBackward.current) {
          velocity.current.z -= direction.current.z * 15.0 * delta;
        }
        if (moveLeft.current || moveRight.current) {
          velocity.current.x -= direction.current.x * 15.0 * delta;
        }
        
        // Movement and collision checks
        const nextPosition = new THREE.Vector3().copy(camera.position);
        
        const moveX = -velocity.current.x * delta;
        const moveZ = -velocity.current.z * delta;
        
        nextPosition.x += moveX;
        if (!checkCollision(nextPosition)) {
          controlsRef.current.moveRight(moveX);
        } else {
          velocity.current.x = 0;
        }
        
        nextPosition.x = camera.position.x;
        nextPosition.z += moveZ;
        if (!checkCollision(nextPosition)) {
          controlsRef.current.moveForward(moveZ);
        } else {
          velocity.current.z = 0;
        }
        
        prevTime.current = time;
      }
      
      renderer.render(sceneRef.current, camera);
    };
    
    // Initialize scene and load models
    const initScene = async () => {
      try {
        const grassModel = await loadGrassModel();
        if (grassModel && sceneRef.current) {
          generateTerrain(sceneRef.current, grassModel);
          animate();
        }
      } catch (error) {
        console.error('Error loading grass model:', error);
      }
    };
    
    initScene();
    // Set sky color
    scene.background = new THREE.Color(0x8BB7DA);
    // Animation loop is now defined above in the code
    
    // Don't start animate here - moved to after terrain generation
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      // Dispose of all geometries and materials in the scene
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
    // Removed collision detection function from here since it's now declared at the top
  }, [gameState]);
  const renderTitleScreen = () => (
    <div className="title-screen" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))',
      zIndex: 2,
    }}>
      <style>
        {`
          @font-face {
            font-family: 'MinecraftFont';
            src: url('https://db.onlinewebfonts.com/t/6ab539c6fc2b21ff0b149b3d06d7f97c.woff2') format('woff2');
            font-display: swap;
          }
        `}
      </style>
      <h1 style={{
        fontSize: '64px',
        fontFamily: 'MinecraftFont, monospace',
        color: '#ffffff',
        textShadow: '2px 2px #3f3f3f',
        transform: 'rotate(-10deg)',
        marginBottom: '50px',
        textAlign: 'center',
        letterSpacing: '2px',
      }}>
        Minecraft React Edition
      </h1>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '300px',
      }}>
        <button
          onClick={() => {
            setGameState('playing');
            // Request pointer lock when starting the game
            setTimeout(() => {
              if (controlsRef.current) {
                controlsRef.current.lock();
              }
            }, 100);
          }}
          style={{
            padding: '15px',
            fontSize: '20px',
            fontFamily: 'Minecraft, monospace',
            background: '#4CAF50',
            border: '2px solid #2E7D32',
            color: 'white',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.target.style.background = '#43A047'}
          onMouseLeave={e => e.target.style.background = '#4CAF50'}
        >
          Play Game
        </button>
        <button
          onClick={() => setGameState('options')}
          style={{
            padding: '15px',
            fontSize: '20px',
            fontFamily: 'Minecraft, monospace',
            background: '#757575',
            border: '2px solid #424242',
            color: 'white',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.target.style.background = '#616161'}
          onMouseLeave={e => e.target.style.background = '#757575'}
        >
          Options
        </button>
      </div>
    </div>
  );
  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000000',
    }}>
      <div ref={mountRef} style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
      }} />
      {gameState === 'title' && renderTitleScreen()}
      {gameState === 'playing' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '24px',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 2,
          opacity: showInventory ? 0 : 1,
        }}>
          +
        </div>
      )}
      {showInventory && gameState === 'playing' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '400px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          border: '2px solid #ffffff',
          zIndex: 3,
          display: 'grid',
          gridTemplateColumns: 'repeat(9, 1fr)',
          gap: '4px',
          padding: '10px',
        }}>
          {Array(36).fill(null).map((_, i) => (
            <div key={i} style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid #555',
              aspectRatio: '1',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }} />
          ))}
        </div>
      )}
    </div>
  );
};
const container = document.getElementById('renderDiv');
const root = ReactDOM.createRoot(container);
root.render(<App />);
