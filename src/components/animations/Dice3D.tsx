import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface DieProps {
  rolling: boolean;
  result: number;
}

const Die: React.FC<DieProps> = ({ rolling, result }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Define rotations for each face (1-6)
  const faceRotations: { [key: number]: [number, number, number] } = {
    1: [0, 0, 0],
    2: [0, Math.PI / 2, 0],
    3: [Math.PI / 2, 0, 0],
    4: [-Math.PI / 2, 0, 0],
    5: [0, -Math.PI / 2, 0],
    6: [Math.PI, 0, 0],
  };

  useFrame((state, delta) => {
    if (rolling && meshRef.current) {
      meshRef.current.rotation.x += delta * 15;
      meshRef.current.rotation.y += delta * 12;
      meshRef.current.rotation.z += delta * 10;
    } else if (meshRef.current) {
      // Smoothly snap to the result face
      const target = faceRotations[result] || [0, 0, 0];
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, target[0], 0.1);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, target[1], 0.1);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, target[2], 0.1);
    }
  });

  return (
    <Box ref={meshRef} args={[2, 2, 2]}>
      {[...Array(6)].map((_, i) => (
        // @ts-ignore
        <meshStandardMaterial
          key={i}
          attach={`material-${i}`}
          color={i % 2 === 0 ? "#ffffff" : "#f0f0f0"}
        />
      ))}
      {/* Numbers simplified for this demo, usually would use textures */}
    </Box>
  );
};

export const Dice3D: React.FC<DieProps> = ({ rolling, result }) => {
  return (
    <div className="w-full h-48 bg-slate-900 rounded-xl overflow-hidden">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} />
        {/* @ts-ignore */}
        <ambientLight intensity={0.5} />
        {/* @ts-ignore */}
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Die rolling={rolling} result={result} />
      </Canvas>
    </div>
  );
};
