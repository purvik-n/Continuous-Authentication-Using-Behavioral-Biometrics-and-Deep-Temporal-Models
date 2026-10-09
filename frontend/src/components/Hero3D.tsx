import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Sparkles, Environment, ContactShadows, Text, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';



function ShieldCore({ isImpostor }: { isImpostor: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Transition color based on impostor state
  const targetColor = useMemo(() => new THREE.Color(isImpostor ? '#F04438' : '#12B76A'), [isImpostor]);
  const currentColor = useRef(new THREE.Color('#12B76A'));

  useFrame((state, delta) => {
    if (meshRef.current) {
      currentColor.current.lerp(targetColor, delta * 3);
      (meshRef.current.material as THREE.MeshStandardMaterial).color.copy(currentColor.current);
      (meshRef.current.material as THREE.MeshStandardMaterial).emissive.copy(currentColor.current).multiplyScalar(0.5);
      meshRef.current.rotation.y += delta * (isImpostor ? 2 : 0.5);
      meshRef.current.rotation.x += delta * (isImpostor ? 1 : 0.2);
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial metalness={0.8} roughness={0.2} />
      </mesh>
    </Float>
  );
}

function GlassOuter() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y -= delta * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <torusGeometry args={[1.5, 0.2, 16, 100]} />
        <MeshTransmissionMaterial 
          backside 
          thickness={0.5} 
          roughness={0.1} 
          transmission={1} 
          ior={1.5} 
          chromaticAberration={0.05} 
          anisotropy={0.1}
          color="#e0e5ff"
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.8, 0.1, 16, 100]} />
        <MeshTransmissionMaterial 
          backside 
          thickness={0.3} 
          roughness={0.2} 
          transmission={0.9} 
          ior={1.2} 
          color="#c0d0ff"
        />
      </mesh>
    </group>
  );
}

function DataRings({ isImpostor }: { isImpostor: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * (isImpostor ? 0.8 : 0.2);
      groupRef.current.rotation.y += delta * (isImpostor ? -0.9 : 0.3);
      groupRef.current.rotation.z += delta * (isImpostor ? 1.2 : 0.1);
      
      const scaleTarget = isImpostor ? 1.3 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(scaleTarget, scaleTarget, scaleTarget), delta * 2);
    }
  });

  return (
    <group ref={groupRef}>
      <Sparkles count={100} scale={5} size={2} speed={isImpostor ? 1 : 0.2} color={isImpostor ? '#fca5a5' : '#a5b4fc'} opacity={isImpostor ? 0.8 : 0.4} />
      <Sparkles count={50} scale={4} size={3} speed={isImpostor ? 2 : 0.4} color={isImpostor ? '#ef4444' : '#60a5fa'} opacity={0.6} />
    </group>
  );
}

export default function Hero3D({ isImpostor }: { isImpostor: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={['#F7F9FC']} />
      {/* Lights */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
      <spotLight position={[-10, 10, -5]} intensity={0.8} color="#335CFF" />
      
      {/* Objects */}
      <ShieldCore isImpostor={isImpostor} />
      <GlassOuter />
      <DataRings isImpostor={isImpostor} />
      
      {/* Environment & Shadows */}
      <Environment preset="city" />
      <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={10} blur={2} far={4} color={isImpostor ? "#F04438" : "#335CFF"} />
      
      <OrbitControls enableZoom={false} enablePan={false} autoRotate={!isImpostor} autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2 + 0.2} minPolarAngle={Math.PI / 2 - 0.5} />
    </Canvas>
  );
}
