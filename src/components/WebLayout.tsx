import React from 'react';
import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { WebHeader } from './WebHeader';

interface WebLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  maxWidth?: number;
}

export const WebLayout: React.FC<WebLayoutProps> = ({
  children,
  sidebar,
  header,
  maxWidth = 1400,
}) => {
  const { isWeb, isDesktop, isMobile } = useResponsive();

  // On mobile or non-web, render children directly
  if (!isWeb || isMobile) {
    return <>{children}</>;
  }

  // Desktop web layout with sidebar
  return (
    <View style={styles.webContainer}>
      <WebHeader />
      {header && <View style={styles.header}>{header}</View>}
      
      <View style={[styles.contentWrapper, { maxWidth }]}>
        {sidebar && isDesktop && (
          <View style={styles.sidebar}>{sidebar}</View>
        )}
        
        <View style={styles.mainContent}>
          {children}
        </View>
      </View>
    </View>
  );
};

interface WebCardProps {
  children: React.ReactNode;
  style?: any;
  hoverable?: boolean;
}

export const WebCard: React.FC<WebCardProps> = ({ 
  children, 
  style,
  hoverable = true 
}) => {
  const { isWeb, isDesktop } = useResponsive();
  const [isHovered, setIsHovered] = React.useState(false);

  const webStyle = isWeb && isDesktop ? {
    shadowColor: isHovered ? '#3182ce' : '#000',
    shadowOffset: { width: 0, height: isHovered ? 8 : 2 },
    shadowOpacity: isHovered ? 0.15 : 0.08,
    shadowRadius: isHovered ? 16 : 8,
    transform: isHovered && hoverable ? [{ scale: 1.02 }] : [{ scale: 1 }],
    transition: 'all 0.2s ease',
  } : {};

  const cardProps = Platform.OS === 'web' && hoverable ? {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  } : {};

  return (
    <View 
      style={[styles.card, webStyle, style]}
      {...cardProps}
    >
      {children}
    </View>
  );
};

interface WebGridProps {
  children: React.ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: number;
}

export const WebGrid: React.FC<WebGridProps> = ({ 
  children, 
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 16 
}) => {
  const { responsive } = useResponsive();
  
  const columnCount = responsive(
    columns.mobile || 1,
    columns.tablet || 2,
    columns.desktop || 3
  );

  // Calculate width as percentage for React Native
  const itemWidth = `${(100 / columnCount) - (gap * (columnCount - 1) / columnCount / 10)}%`;

  return (
    <View style={[styles.grid, { gap }]}>
      {React.Children.map(children, (child, index) => (
        <View 
          style={{
            width: itemWidth as any,
            marginRight: (index + 1) % columnCount === 0 ? 0 : gap,
            marginBottom: gap,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  contentWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sidebar: {
    width: 280,
    marginRight: 24,
  },
  mainContent: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
