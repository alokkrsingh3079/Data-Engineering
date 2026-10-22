import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import './studio-theme.css';
import './studio-layout.css';

const App = lazy(() => import('./App'));
const DataEngineeringInterview = lazy(() => import('./DataEngineeringInterview'));
const LearningStudio = lazy(() => import('./LearningStudio'));
const LearningTrackLab = lazy(() => import('./LearningTrackLab'));
const AskAI = lazy(() => import('./AskAI'));
const PySparkLab = lazy(() => import('./PySparkLab'));
const AdminApp = lazy(() => import('./ProductionApp').then((module) => ({ default: module.AdminApp })));
const Analytics = lazy(() => import('./ProductionApp').then((module) => ({ default: module.Analytics })));
const Login = lazy(() => import('./ProductionApp').then((module) => ({ default: module.Login })));
const Interview = lazy(() => import('./ProductionApp').then((module) => ({ default: module.Interview })));
const NotesStudio = lazy(() => import('./NotesStudio'));

const path = location.pathname;
const isFocusedLearningTrack = ['/learn/python-etl', '/learn/azure-data-factory', '/learn/databricks-delta', '/learn/etl-data-quality'].includes(path);
const Page = path === '/ask-ai' ? AskAI
	: path === '/notes' ? NotesStudio
	: path === '/admin' ? AdminApp
	: path === '/login' ? Login
		: path === '/analytics' ? Analytics
			: path === '/interview' ? Interview
				: path === '/ai-interview' ? DataEngineeringInterview
					: path === '/sql' ? App
						: path === '/pyspark' || path === '/learn/pyspark-foundations' ? PySparkLab
							: isFocusedLearningTrack ? LearningTrackLab
								: LearningStudio;

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<Suspense fallback={<main className="appLoading" aria-live="polite">Loading workspace…</main>}>
			<Page />
		</Suspense>
	</React.StrictMode>
);
