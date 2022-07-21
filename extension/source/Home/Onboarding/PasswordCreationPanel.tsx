import { ArrowRight } from 'phosphor-react';
import { FunctionComponent, useState } from 'react';

import Button from '../../components/Button';
import PasswordCreationForm from './PasswordCreationForm';
import { useQuill } from '../../QuillContext';

const PasswordCreationPanel: FunctionComponent<{
  onComplete: () => void;
}> = ({ onComplete }) => {
  const { cells } = useQuill();

  const [password, setPassword] = useState<string>();

  const handleNext = async () => {
    // Temporary solution to save the password until the phrase
    // is created. We could create the HDPhrase at the point the
    // password is created to avoid temporarily storing the password.
    await cells.onboarding.update({ tempPassword: password });
    onComplete();
  };

  return (
    <>
      <div className="mb-10">
        <div className="font-bold">Let&apos;s start by setting a password.</div>
        <span>
          Occasionally we will ask you for this to prevent unwanted access of
          your wallets.
        </span>
      </div>
      <div className="h-40">
        <PasswordCreationForm onPasswordUpdate={setPassword} />
      </div>
      <div className="py-24 float-right">
        <Button
          className={`w-32 ${
            password === undefined ? 'btn-disabled' : 'btn-primary'
          }`}
          onPress={() => password && handleNext()}
          icon={<ArrowRight className="icon-md" />}
        >
          Continue
        </Button>
      </div>
    </>
  );
};

export default PasswordCreationPanel;
