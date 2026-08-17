CREATE TYPE public.enum_permissions_excluded_pages AS ENUM (
  'all',
  'home:quickLinks',
  'home:knowledgeBase',
  'home:eventsBlock',
  'home:edmSlider',
  'home:newsSlider',
  'home:timeZones',
  'home:featuredSpotlight',
  'route:calendar',
  'route:posts',
  'route:search',
  'route:seat-scanner',
  'route:pre-departure'
);

ALTER TYPE public.enum_permissions_excluded_pages OWNER TO payload_app;