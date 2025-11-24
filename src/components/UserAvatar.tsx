import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';

interface UserAvatarProps {
  imageUrl?: string;
  name: string;
  size?: number;
  verified?: boolean;
  style?: ViewStyle;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  imageUrl,
  name,
  size = 40,
  verified = false,
  style,
}) => {
  const getInitials = () => {
    const names = name.trim().split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const badgeSize = size * 0.3;

  return (
    <View style={[{ width: size, height: size }, style]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.avatarPlaceholder,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              {
                fontSize: size * 0.4,
              },
            ]}
          >
            {getInitials()}
          </Text>
        </View>
      )}
      {verified && (
        <View
          style={[
            styles.verifiedBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              bottom: -2,
              right: -2,
            },
          ]}
        >
          <Text style={{ fontSize: badgeSize * 0.6, color: '#fff' }}>✓</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#e2e8f0',
  },
  avatarPlaceholder: {
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  verifiedBadge: {
    position: 'absolute',
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
