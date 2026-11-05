export const makeJwt = (claims: unknown) =>
  `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
