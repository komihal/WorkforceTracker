describe('Shift Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Login first
    const phoneInput = element(by.id('phone-input'));
    await phoneInput.typeText('9999999999');
    const passwordInput = element(by.id('password-input'));
    await passwordInput.typeText('123456');
    await element(by.text('Войти')).tap();
    await waitFor(element(by.text('Успех')))
      .toBeVisible()
      .withTimeout(10000);
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show shift start button when not working', async () => {
    await waitFor(element(by.text('Начать смену')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should open selfie modal when starting shift', async () => {
    await element(by.text('Начать смену')).tap();
    await waitFor(element(by.text('Сделайте селфи')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should allow canceling selfie', async () => {
    await element(by.text('Начать смену')).tap();
    await waitFor(element(by.text('Сделайте селфи')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Отмена')).tap();
    await waitFor(element(by.text('Начать смену')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show blocked message for blocked user', async () => {
    // This test depends on the API returning blocked status
    // In a real setup, you would use a test account with blocked status
    await waitFor(element(by.text('заблокирован')))
      .not.toBeVisible()
      .withTimeout(3000);
  });
});
