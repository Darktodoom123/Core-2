import { registerRootComponent } from 'expo';
import App from './App';

// Register the root component for Expo / React Native execution environment.
// Falls back to direct export if registerRootComponent is unavailable.
if (typeof registerRootComponent === 'function') {
    registerRootComponent(App);
}

export default App;
