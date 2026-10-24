import config from './config';
import controllers from './controllers';
import routes from './routes';

const plugin: {
  config: typeof config;
  controllers: typeof controllers;
  routes: typeof routes;
} = { config, controllers, routes };

export default plugin;
