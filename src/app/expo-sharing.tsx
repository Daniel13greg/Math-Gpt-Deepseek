import { Redirect } from 'expo-router';

/**
 * Sharing into the app opens `mathgpt://expo-sharing`; the shared content itself is picked up
 * by useShareIntake, so this route only returns to the main screen.
 */
export default function ShareRedirect() {
  return <Redirect href="/" />;
}
