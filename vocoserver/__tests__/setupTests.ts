jest.mock('mongoose', () => {
  const SchemaMock: any = class {
    static import() { return {}; }
    pre() { return this; }
    index() { return this; }
    virtual() { return this; }
    set() { return this; }
    get() { return this; }
    method() { return this; }
    static() { return this; }
  };
  SchemaMock.Types = {
    Mixed: 'Mixed',
    ObjectId: 'ObjectId',
    String: 'String',
    Number: 'Number',
    Boolean: 'Boolean',
    Date: 'Date',
    Array: 'Array',
  };
  return {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    model: jest.fn(),
    Schema: SchemaMock,
    models: {},
    connection: { readyState: 1 },
  };
});

jest.mock('../src/models/Counter', () => ({
  findOneAndUpdate: jest.fn(),
}));

global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};