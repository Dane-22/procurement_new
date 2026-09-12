import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { typography, colors } from '../theme';

export const Text = ({ 
  children, 
  variant = 'body', 
  color,
  style, 
  ...props 
}) => {
  const variantStyle = typography[variant] || typography.body;
  
  return (
    <RNText 
      style={[
        variantStyle, 
        color && { color: colors[color] || color },
        style
      ]} 
      {...props}
    >
      {children}
    </RNText>
  );
};
