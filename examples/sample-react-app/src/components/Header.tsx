import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { UserAvatar } from './UserAvatar';

export const Header: React.FC = () => {
  const { user } = useUser();

  return (
    <header className="header">
      <div className="header-content">
        <nav className="navigation">
          <Link to="/" className="nav-link">Dashboard</Link>
          <Link to="/todos" className="nav-link">Todos</Link>
        </nav>

        <div className="user-section">
          {user && (
            <>
              <span className="user-name">Welcome, {user.name}</span>
              <Link to="/profile">
                <UserAvatar user={user} />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};