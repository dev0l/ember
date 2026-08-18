import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { EmberBackground } from './EmberBackground';
import { EmberCore } from './EmberCore';
import { EmberPath } from './EmberPath';

interface EmberCanvasProps {
  state: string;
  nodes: any[];
  selectedNodeId: string | null;
  pulseVal: any;
  revealVal: any;
  selectVal: any;
  transitionVal: any;
  cx: number;
  cy: number;
  orbitRadius: number;
  closeRadius: number;
}

export const EmberCanvas = ({
  state,
  nodes,
  selectedNodeId,
  pulseVal,
  revealVal,
  selectVal,
  transitionVal,
  cx,
  cy,
  orbitRadius,
  closeRadius,
}: EmberCanvasProps) => {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <EmberBackground />
      
      {/* Paths from center to nodes */}
      {nodes.map((node) => {
        const rad = ((node.offsetAngle - 90) * Math.PI) / 180;
        const nx = cx + orbitRadius * node.offsetRadius * Math.cos(rad);
        const ny = cy + orbitRadius * node.offsetRadius * Math.sin(rad);
        const isSelected = selectedNodeId === node.id;

        return (
          <EmberPath
            key={`path-${node.id}`}
            cx={cx}
            cy={cy}
            nx={nx}
            ny={ny}
            orbitRadius={orbitRadius}
            closeRadius={closeRadius}
            isSelected={isSelected}
            hasSelection={selectedNodeId !== null}
            revealVal={revealVal}
            selectVal={selectVal}
            transitionVal={transitionVal}
          />
        );
      })}

      {/* Pulsing Ember Core */}
      <EmberCore
        cx={cx}
        cy={cy}
        state={state}
        pulseVal={pulseVal}
        revealVal={revealVal}
        selectVal={selectVal}
        transitionVal={transitionVal}
      />
    </Canvas>
  );
};
