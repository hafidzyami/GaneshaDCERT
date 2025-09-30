// src/config/swaggerDef.ts
export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'VC Issuance API',
    version: '1.0.0',
    description: 'API for requesting and managing Verifiable Credentials',
  },
  servers: [ { url: 'http://localhost:3000' } ],
  tags: [
    { name: 'VC Issuance', description: 'Endpoint for the holder to request a VC.' },
    { name: 'Manual Worker', description: 'Endpoints for an admin to manually control the issuance process.' },
  ],
  paths: {
    '/api/vc-issuance': {
      post: {
        summary: 'Request a new Verifiable Credential',
        tags: ['VC Issuance'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/IssuanceRequest' } },
          },
        },
        responses: { '202': { description: 'Request Accepted' } },
      },
    },
    '/api/manual-worker/next-request': {
      get: {
        summary: 'Fetch the next pending VC request for a specific issuer',
        tags: ['Manual Worker'],
        parameters: [
          {
            name: 'issuer_did',
            in: 'query',
            description: 'The DID of the issuer to fetch requests for.',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'A pending request was successfully fetched.' },
          '404': { description: 'No new requests were found in the queue.' },
          '400': { description: 'Missing required query parameter: issuer_did.' }
        },
      },
    },
    '/api/manual-worker/issue-vc': {
      post: {
        summary: 'Issue the VC for the fetched request',
        tags: ['Manual Worker'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  jobDetails: { type: 'object', description: 'The job details from the fetched request.' },
                  signedVc: { type: 'object', description: 'The pre-signed VC object in JSON-LD format.' }
                },
                required: ['jobDetails', 'signedVc'],
              },
            },
          },
        },
        responses: { '200': { description: 'VC was successfully issued.' } },
      },
    },
  },
  components: {
    schemas: {
      Payload: {
        type: 'object',
        properties: {
          holder_did: { type: 'string' },
          nama: { type: 'string' },
          nim: { type: 'string' },
        },
      },
      IssuanceRequest: {
        type: 'object',
        properties: {
          payload: { $ref: '#/components/schemas/Payload' },
          signature: { type: 'string' },
          issuer_did: { type: 'string' },
        },
      },
    },
  },
};