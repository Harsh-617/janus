export function JanusDivider() {
  return (
    <div className="flex flex-col items-center h-full w-10">
      <div className="flex-1 w-0.5" style={{ background: "rgba(201, 168, 76, 0.3)" }} />

      <div className="flex-shrink-0 my-2">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" stroke="#C9A84C" strokeWidth="1.5" />
          <line x1="16" y1="2" x2="16" y2="30" stroke="#C9A84C" strokeWidth="1" strokeOpacity="0.5" />
          {/* Left face — bump curving outward to the left */}
          <path d="M16 11 C10 11, 8 14, 8 16 C8 18, 10 21, 16 21" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
          {/* Right face — bump curving outward to the right */}
          <path d="M16 11 C22 11, 24 14, 24 16 C24 18, 22 21, 16 21" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="flex-1 w-0.5" style={{ background: "rgba(201, 168, 76, 0.3)" }} />
    </div>
  );
}
