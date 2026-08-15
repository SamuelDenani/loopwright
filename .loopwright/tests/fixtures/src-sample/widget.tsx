import React from 'react';

function Widget({ isVisible, title }: { isVisible: boolean; title: string }) {
  return isVisible ? <div className="widget" data-title={title}>Visible</div> : <span>Hidden</span>;
}

export default Widget;
