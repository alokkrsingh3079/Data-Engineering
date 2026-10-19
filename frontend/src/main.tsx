import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const App = lazy(() => import('./App'));
const DataEngineeringInterview = lazy(() => import('./DataEngineeringInterview'));
const LearningStudio = lazy(() => import('./LearningStudio'));
const AdminApp = lazy(() => import('./ProductionApp').then((module) => ({ default: module.AdminApp })));
const Analytics = lazy(() => import('./ProductionApp').then((module) => ({ default: module.Analytics })));
const Login = lazy(() => import('./ProductionApp').then((module) => ({ default: module.Login })));
const Interview = lazy(() => import('./ProductionApp').then((module) => ({ default: module.Interview })));

const path = location.pathname;
const Page = path === '/admin' ? AdminApp
	: path === '/login' ? Login
		: path === '/analytics' ? Analytics
			: path === '/interview' ? Interview
				: path === '/ai-interview' ? DataEngineeringInterview
					: path === '/sql' ? App
						: LearningStudio;

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<Suspense fallback={<main className="appLoading" aria-live="polite">Loading workspace…</main>}>
			<Page />
		</Suspense>
	</React.StrictMode>
);
