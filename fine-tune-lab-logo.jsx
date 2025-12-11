import React, { useState } from 'react';

export default function FineTuneLabLogo() {
  const [rotation, setRotation] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const handleDialClick = () => {
    setRotation((prev) => (prev + 45) % 360);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '2rem'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem'
      }}>
        {/* Logo Container */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleDialClick}
          style={{
            cursor: 'pointer',
            position: 'relative',
            transition: 'transform 0.3s ease'
          }}
        >
          {/* Outer Glow */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '240px',
            height: '240px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
            filter: 'blur(20px)',
            opacity: isHovered ? 1 : 0.6,
            transition: 'opacity 0.3s ease'
          }} />

          <svg width="200" height="200" viewBox="0 0 200 200">
            {/* Outer Ring */}
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="url(#gradient1)"
              strokeWidth="2"
              opacity="0.5"
            />

            {/* Main Dial Circle */}
            <circle
              cx="100"
              cy="100"
              r="75"
              fill="url(#dialGradient)"
              stroke="url(#gradient1)"
              strokeWidth="3"
            />

            {/* Precision Tick Marks */}
            {[...Array(24)].map((_, i) => {
              const angle = (i * 15 - 90) * (Math.PI / 180);
              const isMajor = i % 3 === 0;
              const startRadius = isMajor ? 65 : 68;
              const endRadius = 75;
              const x1 = 100 + startRadius * Math.cos(angle);
              const y1 = 100 + startRadius * Math.sin(angle);
              const x2 = 100 + endRadius * Math.cos(angle);
              const y2 = 100 + endRadius * Math.sin(angle);
              
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isMajor ? '#60a5fa' : '#3b82f6'}
                  strokeWidth={isMajor ? '2' : '1'}
                  opacity={isMajor ? '0.9' : '0.6'}
                />
              );
            })}

            {/* Rotating Pointer Group */}
            <g
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: '100px 100px',
                transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {/* Pointer Indicator */}
              <line
                x1="100"
                y1="100"
                x2="100"
                y2="35"
                stroke="url(#pointerGradient)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              
              {/* Pointer Tip Glow */}
              <circle
                cx="100"
                cy="35"
                r="5"
                fill="#f0abfc"
                filter="url(#glow)"
              />
            </g>

            {/* Center Hub */}
            <circle
              cx="100"
              cy="100"
              r="12"
              fill="url(#centerGradient)"
              stroke="#60a5fa"
              strokeWidth="2"
            />

            {/* Mini Dials */}
            {[0, 120, 240].map((angle, i) => {
              const radian = (angle - 90) * (Math.PI / 180);
              const radius = 55;
              const x = 100 + radius * Math.cos(radian);
              const y = 100 + radius * Math.sin(radian);
              
              return (
                <g key={i}>
                  {/* Mini dial outer ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r="10"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                  
                  {/* Mini dial face */}
                  <circle
                    cx={x}
                    cy={y}
                    r="8"
                    fill="url(#miniDialGradient)"
                    stroke="#60a5fa"
                    strokeWidth="1"
                  />
                  
                  {/* Mini dial tick marks */}
                  {[0, 90, 180, 270].map((tickAngle, j) => {
                    const tickRadian = (tickAngle - 90) * (Math.PI / 180);
                    const tickStart = 6;
                    const tickEnd = 8;
                    const x1 = x + tickStart * Math.cos(tickRadian);
                    const y1 = y + tickStart * Math.sin(tickRadian);
                    const x2 = x + tickEnd * Math.cos(tickRadian);
                    const y2 = y + tickEnd * Math.sin(tickRadian);
                    
                    return (
                      <line
                        key={j}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#60a5fa"
                        strokeWidth="0.8"
                        opacity="0.8"
                      />
                    );
                  })}
                  
                  {/* Mini dial pointer */}
                  <line
                    x1={x}
                    y1={y}
                    x2={x}
                    y2={y - 6}
                    stroke="#f0abfc"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    style={{
                      transform: `rotate(${(i * 45 + rotation * 0.5)}deg)`,
                      transformOrigin: `${x}px ${y}px`,
                      transition: 'transform 0.5s ease'
                    }}
                  />
                  
                  {/* Center dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r="2"
                    fill="#60a5fa"
                  />
                </g>
              );
            })}

            {/* Gradients */}
            <defs>
              <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              
              <radialGradient id="dialGradient">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>
              
              <linearGradient id="pointerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f0abfc" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              
              <radialGradient id="centerGradient">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1e40af" />
              </radialGradient>
              
              <radialGradient id="miniDialGradient">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>
              
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
          </svg>
        </div>

        {/* Typography */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            Fine Tune Lab
          </h1>
          
          <p style={{
            fontSize: '1.125rem',
            color: '#94a3b8',
            margin: '0 0 1rem 0',
            letterSpacing: '0.02em',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            The Continuous Intelligence Platform for AI Models.
          </p>
          
          <p style={{
            fontSize: '0.95rem',
            color: '#64748b',
            margin: '0 0 0.5rem 0',
            textAlign: 'center',
            maxWidth: '600px',
            lineHeight: '1.6'
          }}>
            Train → Assess → Benchmark → Deploy → Monitor → Retrain.
          </p>
          
          <p style={{
            fontSize: '0.9rem',
            color: '#64748b',
            margin: 0,
            textAlign: 'center',
            maxWidth: '600px',
            lineHeight: '1.6'
          }}>
            Real-world analytics feed your next fine-tune automatically.
          </p>
          
          <p style={{
            fontSize: '0.95rem',
            color: '#60a5fa',
            margin: '0.75rem 0 0 0',
            textAlign: 'center',
            fontWeight: '600',
            letterSpacing: '0.05em'
          }}>
            Zero code. Full control.
          </p>
        </div>

        {/* Interactive Hint */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem 2rem',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <p style={{
            color: '#60a5fa',
            margin: 0,
            fontSize: '0.9rem'
          }}>
            Click the dial to adjust parameters
          </p>
        </div>
      </div>
    </div>
  );
}
