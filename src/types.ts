export type Auth0 = {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_at: number;
};

export type Pending = {
  verifier: string;
  state: string;
  nonce: string;
};

export type Pyy = {
  authorization: string;
  cookie: string;
  slug: string;
};

export type Session = {
  auth0?: Auth0;
  pyy?: Pyy;
  userId?: number;
  pending?: Pending;
};

export type Payslip = {
  projectId: string;
  paymentId: number;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  name: string;
  directUrl: string;
};
