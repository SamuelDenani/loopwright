import React from 'react';

function LegacyComponent({ children, type }) {
  return (
    <div className={`legacy-${type}`}>
      <header>
        <h1>Legacy Component</h1>
      </header>
      {children}
    </div>
  );
}

it.skip('old', () => {
  // This test is skipped
});

export default LegacyComponent;
