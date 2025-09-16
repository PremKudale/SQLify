import React, { useEffect } from 'react';

const OceanAnimationEffects = () => {
  useEffect(() => {
    // Create ocean waves
    const waves = document.createElement('div');
    waves.className = 'ocean-waves';
    document.querySelector('.app-container').appendChild(waves);
    
    const waves2 = document.createElement('div');
    waves2.className = 'ocean-waves';
    document.querySelector('.app-container').appendChild(waves2);
    
    // Create floating bubbles
    for (let i = 0; i < 5; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      document.querySelector('.app-container').appendChild(bubble);
    }
    
    // Create floating treasures container
    const treasures = document.createElement('div');
    treasures.className = 'floating-treasures';
    document.querySelector('.app-container').appendChild(treasures);
    
    // Add floating treasure items
    for (let i = 0; i < 3; i++) {
      const treasure = document.createElement('div');
      treasure.className = 'treasure';
      treasures.appendChild(treasure);
    }
    
    // Add typewriter effect to current task
    const addTypewriterEffect = () => {
      const questionElement = document.querySelector('.task-container p');
      if (questionElement) {
        const text = questionElement.textContent;
        questionElement.textContent = '';
        
        let i = 0;
        const typeWriter = () => {
          if (i < text.length) {
            questionElement.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 25);
          }
        };
        
        typeWriter();
      }
    };
    
    // Add glow effect to buttons
    const addButtonEffects = () => {
      const button = document.querySelector('button');
      if (button) {
        button.addEventListener('mousemove', (e) => {
          const rect = button.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          button.style.setProperty('--x-pos', `${x}px`);
          button.style.setProperty('--y-pos', `${y}px`);
        });
      }
    };
    
    // Initialize effects
    addTypewriterEffect();
    addButtonEffects();
    
    // Cleanup on component unmount
    return () => {
      document.querySelectorAll('.ocean-waves, .bubble, .floating-treasures').forEach(el => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    };
  }, []);
  
  return null;
};

export default OceanAnimationEffects;