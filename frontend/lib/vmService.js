import api from './api';

export const vmService = {
  list:      ()     => api.get('/vm/list'),
  get:       (id)   => api.get(`/vm/${id}`),
  create:    (data) => api.post('/vm/create', data),
  start:     (id)   => api.post(`/vm/start/${id}`),
  stop:      (id)   => api.post(`/vm/stop/${id}`),
  restart:   (id)   => api.post(`/vm/restart/${id}`),
  remove:    (id)   => api.delete(`/vm/${id}`),
  templates: ()     => api.get('/vm/templates'),
  vncTicket: (id)   => api.get(`/console/ticket/${id}`),
};

export const usageService = {
  stats: ()       => api.get('/usage/stats'),
  logs:  (params) => api.get('/usage/logs', { params }),
};

export const labService = {
  list:        ()              => api.get('/labs'),
  get:         (labId)        => api.get(`/labs/${labId}`),
  getSession:  (vmId)         => api.get(`/labs/session/${vmId}`),
  start:       (labId)        => api.post('/labs/start', { labId }),
  executeStep: (vmId, stepId) => api.post('/labs/execute-step', { vmId, stepId }),
};
