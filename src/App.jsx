import { useState, useEffect } from 'react';
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { celoAlfajores, mainnet } from 'viem/chains';

// Updated ABI to use array length
import CONTRACT_ABI from "./contracts/vote.abi.json"

const CONTRACT_ADDRESS = "0x38E061a6254c846408d06315216E65281185BEdF";

export default function App() {
  const [polls, setPolls] = useState([]);
  const [currentPoll, setCurrentPoll] = useState(null);
  const [newPollTitle, setNewPollTitle] = useState('');
  const [candidates, setCandidates] = useState(['', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [error, setError] = useState(null);

  // Initialize viem clients
  const publicClient = createPublicClient({
    chain: celoAlfajores,
    transport: http()
  });

  const walletClient = createWalletClient({
    chain: celoAlfajores,
    transport: custom(window.ethereum),
    account: account
  });

  // Connect wallet
  const connectWallet = async () => {
    setError(null);
    try {
      const [address] = await walletClient.requestAddresses();
      setAccount(address);
      setConnected(true);
    } catch (error) {
      setError(`Failed to connect wallet: ${error.message}`);
      console.error('Failed to connect wallet:', error);
    }
  };

  // Create new poll
  const createPoll = async () => {
    if (!connected) {
      setError("Please connect your wallet first");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const filteredCandidates = candidates.filter(c => c.trim() !== '');
      if (filteredCandidates.length < 2) {
        throw new Error("At least two candidates are required");
      }
      const { hash } = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'createPoll',
        args: [newPollTitle, filteredCandidates]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchPolls();
      setNewPollTitle('');
      setCandidates(['', '']);
    } catch (error) {
      console.error('Failed to create poll:', error);
      setError(`Failed to create poll: ${error.message}`);
    }
    setIsLoading(false);
  };

  // Vote in a poll
  const vote = async (pollId, candidateId) => {
    if (!connected) {
      setError("Please connect your wallet first");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { hash } = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'vote',
        args: [pollId, candidateId]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchPolls();
    } catch (error) {
      console.error('Failed to vote:', error);
      setError(`Failed to vote: ${error.message}`);
    }
    setIsLoading(false);
  };

  // Fetch all polls using array iteration
  const fetchPolls = async () => {
    setError(null);
    try {
      // Get the first non-existent poll index to determine length
      let pollCount = 0;
      try {
        while (true) {
          await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'polls',
            args: [pollCount]
          });
          pollCount++;
        }
      } catch (e) {
        // When we hit an invalid index, we've found our length
      }

      const pollsData = await Promise.all(
        Array.from({ length: pollCount }, (_, i) => 
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'polls',
            args: [i]
          })
        )
      );
      
      setPolls(pollsData.map((poll, index) => ({
        id: index,
        title: poll.title,
        isActive: poll.isActive,
        candidates: poll.candidates.map(candidate => ({
          name: candidate.name,
          votes: Number(candidate.voteCount)
        }))
      })));
    } catch (error) {
      console.error('Failed to fetch polls:', error);
      setError(`Failed to fetch polls: ${error.message}`);
    }
  };

  // End a poll
  const endPoll = async (pollId) => {
    if (!connected) {
      setError("Please connect your wallet first");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { hash } = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'endPoll',
        args: [pollId]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchPolls();
    } catch (error) {
      console.error('Failed to end poll:', error);
      setError(`Failed to end poll: ${error.message}`);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-900">Voting DApp</h1>
          <button
            onClick={connectWallet}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            {connected ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Create Poll Form */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Create New Poll</h2>
          <input
            type="text"
            placeholder="Poll Title"
            value={newPollTitle}
            onChange={(e) => setNewPollTitle(e.target.value)}
            className="w-full mb-4 p-2 border rounded"
          />
          <div className="space-y-2 mb-4">
            {candidates.map((candidate, index) => (
              <input
                key={index}
                type="text"
                placeholder={`Candidate ${index + 1}`}
                value={candidate}
                onChange={(e) => {
                  const newCandidates = [...candidates];
                  newCandidates[index] = e.target.value;
                  setCandidates(newCandidates);
                }}
                className="w-full p-2 border rounded"
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCandidates([...candidates, ''])}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
            >
              Add Candidate
            </button>
            <button
              onClick={createPoll}
              disabled={isLoading || !connected}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:opacity-50"
            >
              Create Poll
            </button>
          </div>
        </div>

        {/* Polls List */}
        <div className="space-y-6">
          {polls.map((poll) => (
            <div key={poll.id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">{poll.title}</h3>
                <div className="flex gap-2 items-center">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    poll.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {poll.isActive ? 'Active' : 'Ended'}
                  </span>
                  {poll.isActive && connected && (
                    <button
                      onClick={() => endPoll(poll.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm hover:bg-red-200 transition"
                    >
                      End Poll
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {poll.candidates.map((candidate, idx) => {
                  const totalVotes = poll.candidates.reduce((sum, c) => sum + c.votes, 0);
                  const percentage = totalVotes === 0 ? 0 : (candidate.votes / totalVotes * 100).toFixed(1);
                  
                  return (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-700">{candidate.name}</span>
                        <span className="text-sm text-gray-500">
                          {candidate.votes} votes ({percentage}%)
                        </span>
                      </div>
                      <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${percentage}%`
                              }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => vote(poll.id, idx)}
                          disabled={!poll.isActive || isLoading || !connected}
                          className="mt-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition disabled:opacity-50"
                        >
                          Vote
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}