import { useState } from 'react';
import { User } from '../types';

/** Google profile photo, falling back to a gold initial if it's missing or fails to load. */
export function UserAvatar({ user, size = 36 }: { user: Pick<User, 'name' | 'picture'>; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (user.picture && !broken) {
    return (
      <img
        src={user.picture}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full border border-gold-500/40 object-cover"
        style={style}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="shrink-0 rounded-full border border-gold-500/40 bg-gold-500/10 flex items-center justify-center font-display text-gold-200"
      style={style}
    >
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}
