import React from 'react';
import { User } from '../types';

interface UserAvatarProps {
  user: User;
  size?: 'small' | 'medium' | 'large';
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 'medium' }) => {
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const sizeClass = `avatar-${size}`;

  return (
    <div className={`user-avatar ${sizeClass}`}>
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} className="avatar-image" />
      ) : (
        <div className="avatar-placeholder">
          {getInitials(user.name)}
        </div>
      )}
    </div>
  );
};