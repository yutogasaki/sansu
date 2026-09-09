import { Navigate } from 'react-router-dom';
import { BUILD_PLAY_ENABLED } from '../../domain/park/feature';
import { islandEnabled } from '../../domain/island/feature';

export function LaunchRoute() {
    // A top-page visit is never a request to resume questions. The destination's
    // PrivateRoute resolves the profile; saved runs only resume on explicit entry.
    const destination = islandEnabled() ? '/island' : BUILD_PLAY_ENABLED ? '/park' : '/battle';
    return <Navigate to={destination} replace />;
}
