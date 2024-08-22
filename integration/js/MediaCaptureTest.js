const { AuthenticateUserStep, JoinMeetingStep, OpenAppStep, ClickMediaCaptureButton, EndMeetingStep } = require('./steps');
const { RosterCheck, UserAuthenticationCheck, UserJoinedMeetingCheck } = require('./checks');
const { AppPage } = require('./pages/AppPage');
const { TestUtils } = require('./node_modules/kite-common');
const SdkBaseTest = require('./utils/SdkBaseTest');
const { Window } = require('./utils/Window');
const { v4: uuidv4 } = require('uuid');

class MediaCaptureTest extends SdkBaseTest {
  constructor(name, kiteConfig) {
    super(name, kiteConfig, 'MediaCapture');
  }

  async runIntegrationTest() {
    this.numberOfParticipant = 2;
    const session = this.seleniumSessions[0];

    // Join a meeting from two browser sessions with video on
    const testAttendeeId = uuidv4();

    const testWindow = await Window.existing(session.driver, 'TEST');

    const meetingId = uuidv4();
    console.log(`testing region: ${this.region}, meetingId: ${meetingId}`);

    await testWindow.runCommands(async () => await this.addUserToMeeting(testAttendeeId, session, this.region));
    // Start media capture session
    await testWindow.runCommands(async () => await ClickMediaCaptureButton.executeStep(this, session));
    await TestUtils.waitAround(5000);

    // Check if media capture started successfully.
    await testWindow.runCommands(async () => await RosterCheck.executeStep(this, session, 2));

    // Stop media capture session
    await testWindow.runCommands(async () => await ClickMediaCaptureButton.executeStep(this, session));
    await TestUtils.waitAround(5000);

    // // Check if media capture stopped successfully.
    await testWindow.runCommands(async () => await RosterCheck.executeStep(this, session, 1));

    await testWindow.runCommands(async () => await EndMeetingStep.executeStep(this, session));
    await this.waitAllSteps();
  }

  async addUserToMeeting(attendee_id, sessionInfo, region) {
    await OpenAppStep.executeStep(this, sessionInfo);
    await AuthenticateUserStep.executeStep(this, sessionInfo, attendee_id, false, false, false, region);
    await UserAuthenticationCheck.executeStep(this, sessionInfo);
    await JoinMeetingStep.executeStep(this, sessionInfo);
    await UserJoinedMeetingCheck.executeStep(this, sessionInfo, attendee_id);
  }
}

module.exports = MediaCaptureTest;

(async () => {
  const kiteConfig = await TestUtils.getKiteConfig(__dirname);
  let test = new MediaCaptureTest('Media Capture test', kiteConfig);
  await test.run();
})();
