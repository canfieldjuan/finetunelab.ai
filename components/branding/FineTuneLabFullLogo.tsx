import React from 'react';

interface FineTuneLabFullLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

/**
 * FineTuneLab Full Logo - F Icon + Wordmark
 * Best for: Primary logo for website, marketing materials, presentations
 */
export const FineTuneLabFullLogo: React.FC<FineTuneLabFullLogoProps> = ({
  width = 400,
  height = 120,
  className = ''
}) => {
  return (
    <svg
      viewBox="0 0 400 120"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>FineTuneLab</title>
      <desc>FineTuneLab logo with adjusting F icon and wordmark</desc>

      {/* Tilted F (lighter) - rotated in reverse around bottom axis */}
      <g transform="translate(35, 30)">
        <g transform="rotate(-15, 3, 60)" opacity="0.3">
          <rect x="0" y="0" width="6" height="60" fill="#FF6B35" rx="3" />
          <rect x="0" y="0" width="35" height="6" fill="#FF6B35" rx="3" />
          <rect x="0" y="27" width="30" height="6" fill="#FF6B35" rx="3" />
        </g>
      </g>

      {/* Straight F (solid) */}
      <g transform="translate(35, 30)">
        <rect x="0" y="0" width="6" height="60" fill="#FF6B35" rx="3" />
        <rect x="0" y="0" width="35" height="6" fill="#FF6B35" rx="3" />
        <rect x="0" y="27" width="30" height="6" fill="#FF6B35" rx="3" />
      </g>

      {/* Wordmark */}
      <text
        x="72"
        y="70"
        fontFamily="'Inter', sans-serif"
        fontSize="40"
        fontWeight="600"
        fill="#000000"
      >
        FineTuneLab
      </text>
    </svg>
  );
};

export default FineTuneLabFullLogo;
