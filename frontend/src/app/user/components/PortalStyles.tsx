// Shared CSS (scrollbar hiding, custom video sliders) for both portals.
export function PortalStyles() {
  return (
    <style>{`
      div::-webkit-scrollbar { display: none; }
      .wedflix-seek {
        -webkit-appearance: none; appearance: none;
        width: 100%; height: 4px; border-radius: 9999px;
        outline: none; cursor: pointer;
        background: linear-gradient(to right,
          #E50914 var(--pct, 0%), rgba(255,255,255,0.25) var(--pct, 0%));
      }
      .wedflix-seek:hover { height: 6px; }
      .wedflix-seek::-webkit-slider-thumb {
        -webkit-appearance: none; width: 14px; height: 14px;
        border-radius: 50%; background: white; cursor: pointer;
        box-shadow: 0 0 4px rgba(0,0,0,0.5);
      }
      .wedflix-seek::-moz-range-thumb {
        width: 14px; height: 14px; border-radius: 50%;
        background: white; border: none; cursor: pointer;
      }
      .wedflix-vol {
        -webkit-appearance: none; appearance: none;
        height: 3px; border-radius: 9999px; outline: none; cursor: pointer;
        background: linear-gradient(to right,
          rgba(255,255,255,0.9) var(--pct, 100%),
          rgba(255,255,255,0.2) var(--pct, 100%));
      }
      .wedflix-vol::-webkit-slider-thumb {
        -webkit-appearance: none; width: 10px; height: 10px;
        border-radius: 50%; background: white; cursor: pointer;
      }
      .wedflix-vol::-moz-range-thumb {
        width: 10px; height: 10px; border-radius: 50%;
        background: white; border: none;
      }
    `}</style>
  );
}
