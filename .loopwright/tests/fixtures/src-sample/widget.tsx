import React from 'react';

function Widget() {
  const ArrowTest = <T,>(a: T, b: T) => a;
  return <Component data={() => ArrowTest(1, 2)} />;
}

export default Widget;
