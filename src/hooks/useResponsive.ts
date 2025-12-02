import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

export type ScreenSize = 'mobile' | 'tablet' | 'desktop';

export const useResponsive = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const isWeb = Platform.OS === 'web';
  const width = dimensions.width;
  const height = dimensions.height;

  // Breakpoints
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const screenSize: ScreenSize = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

  return {
    isWeb,
    isMobile,
    isTablet,
    isDesktop,
    screenSize,
    width,
    height,
    // Responsive values helper
    responsive: <T,>(mobile: T, tablet?: T, desktop?: T): T => {
      if (isDesktop && desktop !== undefined) return desktop;
      if (isTablet && tablet !== undefined) return tablet;
      return mobile;
    },
  };
};
