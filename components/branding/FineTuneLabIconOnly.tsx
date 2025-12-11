import React from 'react';

interface FineTuneLabIconOnlyProps {
  size?: number;
  className?: string;
}

/**
 * FineTuneLab Icon Only - Standalone adjusting F icon
 * Best for: App icon, favicon, social media profile picture, compact spaces
 */
export const FineTuneLabIconOnly: React.FC<FineTuneLabIconOnlyProps> = ({
  size = 120,
  className = ''
}) => {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>FineTuneLab Icon</title>
      <desc>Adjusting F icon showing fine-tuning process</desc>

      {/* Centered icon-only version */}
      <g transform="translate(42, 30)">
        {/* Tilted F (lighter) - rotated in reverse around bottom axis */}
        <g transform="rotate(-15, 3, 60)" opacity="0.3">
          <rect x="0" y="0" width="6" height="60" fill="#FF6B35" rx="3" />
          <rect x="0" y="0" width="35" height="6" fill="#FF6B35" rx="3" />
          <rect x="0" y="27" width="30" height="6" fill="#FF6B35" rx="3" />
        </g>

        {/* Straight F (solid) */}
        <rect x="0" y="0" width="6" height="60" fill="#FF6B35" rx="3" />
        <rect x="0" y="0" width="35" height="6" fill="#FF6B35" rx="3" />
        <rect x="0" y="27" width="30" height="6" fill="#FF6B35" rx="3" />
      </g>
    </svg>
  );
};

export default FineTuneLabIconOnly;
