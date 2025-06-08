# Mobile Detection Store

This directory contains a Zustand store for tracking mobile screen width across the application, ensuring consistent responsive behavior.

## Mobile Detection Usage

### Basic Usage

Import the store and use the `isMobile` state in your components:

```tsx
import { useMobileDetect } from '@/lib/mobileDetectStore';

function MyComponent() {
  const { isMobile } = useMobileDetect();
  
  return (
    <div>
      {isMobile ? (
        <MobileView />
      ) : (
        <DesktopView />
      )}
    </div>
  );
}
```

### Setup in Layout Component

In your root layout or main component, initialize the mobile detection using the custom hook:

```tsx
import { useMobileDetection } from '@/hooks/useMobileDetection';

function RootLayout() {
  // Initialize mobile detection
  useMobileDetection();
  
  return (
    <YourLayout>
      {/* Your app content */}
    </YourLayout>
  );
}
```

### Store API

The `useMobileDetect` store provides:

- `isMobile` - Boolean flag indicating if the current viewport is considered mobile (< 768px)
- `setIsMobile(value)` - Manually set the mobile status
- `checkIfMobile()` - Check and update the mobile status based on current window width

## When to Use

Use this global state rather than individual window.innerWidth checks to:

1. Ensure consistent mobile breakpoints across the application
2. Reduce duplicate resize event listeners
3. Improve performance by centralizing window resize handling 