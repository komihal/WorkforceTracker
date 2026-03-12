describe('Stats Screen', () => {
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

  it('should navigate to stats and show current month', async () => {
    // Navigate to stats tab/screen
    const now = new Date();
    const monthStr = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

    await waitFor(element(by.text(monthStr)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should navigate between months using chevrons', async () => {
    // Click left chevron to go to previous month
    await element(by.text('‹')).tap();

    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevStr = prevMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

    await expect(element(by.text(prevStr))).toBeVisible();

    // Click right chevron to go back
    await element(by.text('›')).tap();

    const now = new Date();
    const currentStr = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    await expect(element(by.text(currentStr))).toBeVisible();
  });
});
