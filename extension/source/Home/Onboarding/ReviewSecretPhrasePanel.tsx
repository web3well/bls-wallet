import { FunctionComponent, useState, useEffect, ChangeEvent } from 'react';

import { ArrowRight } from 'phosphor-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import Range from '../../helpers/Range';
import { useQuill } from '../../QuillContext';

const WordInReview: FunctionComponent<{
  index: number;
  sampleIndex: number;
  word: string;
  handleGuess: (index: number, isCorrect: boolean) => void;
}> = ({ index, sampleIndex, word, handleGuess }) => {
  const [guess, setGuess] = useState('');

  useEffect(() => {
    const isCorrect = guess === word;
    handleGuess(index, isCorrect);
  }, [guess, index, word, handleGuess]);

  const getConfirmWordClass = () => {
    if (guess === '') {
      return [];
    }

    if (guess === word) {
      return [
        'border-2',
        'border-positive-500',
        'bg-positive-500',
        'focus:border-positive-500',
      ];
    }

    if (word.startsWith(guess)) {
      return [
        'border-2',
        'border-neutral-500',
        'bg-neutral-500',
        'focus:border-neutral-500',
      ];
    }

    return [
      'border-2',
      'border-alert-500',
      'bg-alert-500',
      'focus:border-alert-500',
    ];
  };

  return (
    <input
      type="text"
      className={[
        'mt-2',
        'bg-opacity-5',
        'border-opacity-25',
        'focus:border-opacity-25',
        ...getConfirmWordClass(),
      ].join(' ')}
      placeholder={`Secret word ${sampleIndex + 1} ${word}`}
      onInput={(e: ChangeEvent<HTMLInputElement>) => {
        const userEntry = e.target.value.toLowerCase();
        setGuess(userEntry);
      }}
    />
  );
};

const ReviewSecretPhrasePanel: FunctionComponent<{
  secretPhrase: string[];
  sampleIndexes?: number[];
  onBack: () => void;
}> = ({ secretPhrase, sampleIndexes = [0, 3, 9, 11], onBack }) => {
  const { rpc, cells } = useQuill();

  const len = sampleIndexes.length;

  const [reviewWordStates, setReviewWordStates] = useState<boolean[]>(
    Range(len).map(() => false),
  );

  const [allCorrect, setAllCorrect] = useState<boolean>(false);

  const handleGuess = (index: number, isCorrect: boolean) => {
    const snapshot = reviewWordStates;
    snapshot[index] = isCorrect;
    setReviewWordStates(snapshot);
    setAllCorrect(reviewWordStates.every((item) => item === true));
  };

  const navigate = useNavigate();

  const setHDWalletPhrase = async () => {
    // Temporary solution to get the password after the phrase
    // is created. We could create the HDPhrase at the point the
    // password is created to avoid this.
    const password = (await cells.onboarding.read()).tempPassword;

    await rpc.setHDPhrase(secretPhrase.join(' '));
    const address = await rpc.addHDAccount();
    await rpc.setSelectedAddress(address);
    await rpc.createNewVault(password);
    await cells.onboarding.update({ completed: true, tempPassword: '' });

    navigate('/wallets');
  };

  return (
    <div className="w-[28rem]">
      <div className="mb-10">
        <div className="font-bold">
          Ok, last step before you get started with Quill!
        </div>
        <span>
          Let&apos;s check a few words from your secret phrase to make extra
          sure you&apos;ve got it.
        </span>
      </div>

      {Range(4).map((i) => (
        <WordInReview
          handleGuess={handleGuess}
          index={i}
          sampleIndex={sampleIndexes[i]}
          word={secretPhrase[i].toLowerCase()}
          key={`s${i}`}
        />
      ))}

      <div className="mt-2 text-grey-500">
        You must correctly enter your secret phrase words before you can
        proceed.
      </div>
      <div>
        <div className="flex gap-2 mt-6">
          <Button className="btn-secondary w-1/2" onPress={onBack}>
            Back
          </Button>
          <Button
            className={`w-1/2 ${allCorrect ? 'btn-primary' : 'btn-disabled'}`}
            onPress={() => allCorrect && setHDWalletPhrase()}
            icon={<ArrowRight className="icon-md" />}
          >
            Confirm secret phrase
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewSecretPhrasePanel;
