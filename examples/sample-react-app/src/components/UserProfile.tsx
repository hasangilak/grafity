import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { apiService } from '../services/apiService';
import { UserAvatar } from './UserAvatar';
import { User, UserPreferences } from '../types';

export const UserProfile: React.FC = () => {
  const { user, setUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(false);

  if (!user) {
    return <div className="error">Please log in to view your profile</div>;
  }

  const handleEdit = () => {
    setEditData({
      name: user.name,
      email: user.email,
      preferences: { ...user.preferences }
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editData.name?.trim()) return;

    setLoading(true);
    try {
      const updatedUser = await apiService.updateUser(user.id, editData);
      setUser(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditData({});
    setIsEditing(false);
  };

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setEditData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value
      } as UserPreferences
    }));
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <UserAvatar user={user} size="large" />
        <div className="profile-info">
          <h1>My Profile</h1>
          <p>Manage your account settings and preferences</p>
        </div>
      </div>

      <div className="profile-content">
        {isEditing ? (
          <div className="edit-form">
            <div className="form-section">
              <h3>Personal Information</h3>

              <div className="form-group">
                <label htmlFor="name">Name:</label>
                <input
                  id="name"
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email:</label>
                <input
                  id="email"
                  type="email"
                  value={editData.email || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Preferences</h3>

              <div className="form-group">
                <label htmlFor="theme">Theme:</label>
                <select
                  id="theme"
                  value={editData.preferences?.theme || 'light'}
                  onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="notifications">
                  <input
                    id="notifications"
                    type="checkbox"
                    checked={editData.preferences?.notifications || false}
                    onChange={(e) => handlePreferenceChange('notifications', e.target.checked)}
                  />
                  Enable notifications
                </label>
              </div>

              <div className="form-group">
                <label htmlFor="language">Language:</label>
                <select
                  id="language"
                  value={editData.preferences?.language || 'en'}
                  onChange={(e) => handlePreferenceChange('language', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button onClick={handleSave} disabled={loading} className="save-btn">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={handleCancel} disabled={loading} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-view">
            <div className="profile-section">
              <h3>Personal Information</h3>
              <div className="profile-field">
                <label>Name:</label>
                <span>{user.name}</span>
              </div>
              <div className="profile-field">
                <label>Email:</label>
                <span>{user.email}</span>
              </div>
            </div>

            <div className="profile-section">
              <h3>Preferences</h3>
              <div className="profile-field">
                <label>Theme:</label>
                <span className="capitalize">{user.preferences.theme}</span>
              </div>
              <div className="profile-field">
                <label>Notifications:</label>
                <span>{user.preferences.notifications ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="profile-field">
                <label>Language:</label>
                <span className="uppercase">{user.preferences.language}</span>
              </div>
            </div>

            <button onClick={handleEdit} className="edit-profile-btn">
              Edit Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};