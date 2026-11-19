import { app, initializeBackend, recoverInterruptedBackgroundJobs } from "./server.js";

const port = Number(process.env.PORT || 4000);

initializeBackend()
  .then(recoverInterruptedBackgroundJobs)
  .then(() => app.listen(port, () => console.log(`SQL Practice backend on http://localhost:${port}`)))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
