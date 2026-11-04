import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pages from './routes/pages.js';
import api from './routes/api.js';
import internal from './routes/internal.js';
import { errorHandler } from './middleware/errors.js';

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
app.set('view engine', 'ejs');
app.set('views', path.join(here, 'views'));
app.use('/assets', express.static(path.join(here, '..', 'public')));
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use((req, res, next) => {
  res.locals.query = req.query;
  next();
});
app.get('/project', (_req, res) =>
  res.render('project', { title: 'How ActorLab works' }),
);
app.use('/api', api);
app.use('/internal', internal);
app.use('/', pages);
app.use((_req, res) =>
  res.status(404).render('layout', {
    view: 'not-found',
    page: 'Not found',
    message: 'Page not found',
  }),
);
app.use(errorHandler);
export default app;
