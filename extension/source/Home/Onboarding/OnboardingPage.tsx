import { FunctionComponent } from 'react';

import OnboardingActionPanel from './OnboardingActionPanel';
import OnboardingInfoPanel from './OnboardingInfoPanel';

const OnboardingPage: FunctionComponent = () => (
  <div className="flex h-screen">
    <OnboardingInfoPanel />
    <OnboardingActionPanel />
  </div>
);

export default OnboardingPage;
