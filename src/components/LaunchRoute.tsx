import { Navigate } from 'react-router-dom';
import { islandEnabled } from '../domain/island/feature';

export function LaunchRoute() {
    // A top-page visit is never a request to resume questions. The destination's
    // PrivateRoute resolves the profile; saved runs only resume on explicit entry.
    const destination = islandEnabled() ? '/island' : '/battle';
    return <Navigate to={destination} replace />;
}
