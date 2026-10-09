const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/synthetic-ods.json'), 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(root, 'golden/characterization.json'), 'utf8'));
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tariffsSource = fs.readFileSync(path.join(root, 'tariffs.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const berezkaSource = fs.readFileSync(path.join(root, 'berezka2.js'), 'utf8');
function extractFunction(source, name) {
  const marker = 'function ' + name + '(';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('Function not found: ' + name);
  const open = source.indexOf('{', start + marker.length);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed function: ' + name);
}
function publicContext() {
  const context = { ORGANIZATION: 'Synthetic Garden', PERSONAL_ACC: '00000000000000000000', BANK_NAME: 'Synthetic Bank', BIC: '000000000', CORRESP_ACC: '00000000000000000000', INN: '0000000000', debug() {}, window: { currentEeData: null } };
  const names = ['isPlotNumber','parseNumber','formatAmountShort','extractOdsRows','parseBaseOds','parseDebitOds','finalizePlot','parseElectricityOds','sanitizePurpose','buildSmartPurpose','buildPaymentQR'];
  vm.createContext(context);
  vm.runInContext(tariffsSource, context);
  vm.runInContext(names.map(name => extractFunction(indexSource, name)).join('\n'), context);
  return context;
}
function appFunction(name, context) {
  vm.createContext(context);
  vm.runInContext(extractFunction(appSource, name), context);
  return context[name];
}
test('TEST-001 existing synthetic plot parses; TEST-002 missing plot is absent', () => {
  const map = publicContext().parseBaseOds(fixture.baseXml);
  assert.equal(map.get(fixture.plot).owner, golden.base.owner);
  assert.equal(map.has('0000x'), false);
});
test('TEST-003 one owner autofills; TEST-004 multiple owners are listed in source order', () => {
  const calls = [], buttons = [];
  const ctx = { plotData: [{plotNumber:fixture.plot,payerName:'Synthetic Owner A',plotSotkas:6},{plotNumber:fixture.plot,payerName:'Synthetic Owner B',plotSotkas:8}], plotSelectionContainer:{style:{}}, ownerSelectionContainer:{style:{}}, mainContentWrapper:{style:{}}, ownerListDiv:{innerHTML:'',appendChild(node){buttons.push(node);}}, document:{createElement(){return {dataset:{},style:{}};}}, autofillWithPlotObject(plot){calls.push(plot);}, showNotification(){} };
  appFunction('autofillPlotData', ctx)(fixture.plot);
  assert.equal(buttons.length, 2);
  assert.deepEqual(buttons.map(button => button.textContent), golden.multipleOwners);
  assert.deepEqual(buttons.map(button => button.dataset.index), [0,1]);
  ctx.plotData = [ctx.plotData[0]];
  appFunction('autofillPlotData', ctx)(fixture.plot);
  assert.equal(calls[0].payerName, 'Synthetic Owner A');
});
test('TEST-005 debt total and category values are read as-is', () => {
  const debt = publicContext().parseDebitOds(fixture.debitXml).get(fixture.plot);
  assert.equal(debt.totalDebt, golden.debt.totalDebt);
  assert.equal(debt.membershipDebt, golden.debt.membershipDebt);
  assert.equal(debt.targetDebt, golden.debt.targetDebt);
});
test('TEST-006 through TEST-009 tariff, previous/current readings and positive consumption', () => {
  const ee = publicContext().parseElectricityOds(fixture.electricityXml).get(fixture.plot);
  assert.equal(ee.tariff, golden.electricity.tariff);
  assert.equal(ee.previousReading, golden.electricity.previousReading);
  assert.equal(ee.currentReading, golden.electricity.currentReading);
  assert.equal(ee.consumption, golden.electricity.consumption);
});
test('TEST-010 decreasing reading clamps consumption; TEST-011 zero consumption stays zero', () => {
  const ctx = publicContext();
  assert.equal(ctx.parseElectricityOds(fixture.decreasingElectricityXml).get(fixture.plot).consumption, 0);
  assert.equal(ctx.parseElectricityOds(fixture.zeroElectricityXml).get(fixture.plot).consumption, 0);
});
test('TEST-012 decimal comma normalization preserves current behavior', () => {
  assert.equal(publicContext().parseNumber('1 234,50'), 1234.5);
});
test('TEST-013 membership and target debt remain separate categories', () => {
  const debt = publicContext().parseDebitOds(fixture.debitXml).get(fixture.plot);
  assert.equal(debt.membershipDebt + debt.targetDebt, debt.totalDebt);
});
test('TEST-014 form total sums checked synthetic components only', () => {
  const ctx = { membershipCheck:{checked:true},membershipSumInput:{value:'10.25'},targetCheck:{checked:true},targetSumInput:{value:'2.75'},arrearsCheck:{checked:false},arrearsSumInput:{value:'99'},workCheck:{checked:false},workSumInput:{value:'50'},electricityCheck:{checked:true},electricitySumInput:{value:'7'},totalAmountElement:{textContent:''},updatePurposeStringCounter(){} };
  appFunction('calculateTotal', ctx)();
  assert.equal(ctx.totalAmountElement.textContent, golden.total);
});
test('TEST-015 public QR payload golden preserves field order and synthetic amount', () => {
  const qr = publicContext().buildPaymentQR(fixture.plot, 12.34, null, false, 'Synthetic fee|note\n');
  assert.equal(qr, golden.qrPublic);
});
test('TEST-016 finance QR purpose golden preserves suffix and truncation', () => {
  const context = { PURPOSE_MAX_LEN: 210 };
  vm.createContext(context);
  vm.runInContext(extractFunction(berezkaSource, 'qrPurpose'), context);
  assert.equal(context.qrPurpose({plotNumber:fixture.plot,customPurpose:'Synthetic fee'}), golden.qrFinancePurpose);
  assert.equal(context.qrPurpose({plotNumber:fixture.plot,customPurpose:'x'.repeat(300)}).length, 210);
});
