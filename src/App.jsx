import { useState, useEffect } from 'react';
import { createPublicClient, http, createWalletClient, custom, parseAbiItem } from 'viem';
import { mainnet } from 'viem/chains';
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

  // Initialize viem clients
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http()
  });

  const walletClient = createWalletClient({
    chain: mainnet,
    transport: custom(window.ethereum)
  });

  // Connect wallet
  const connectWallet = async () => {
    try {
      const [address] = await walletClient.requestAddresses();
      setAccount(address);
      setConnected(true);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  // Create new poll
  const createPoll = async () => {
    if (!connected) return;
    setIsLoading(true);
    try {
      const filteredCandidates = candidates.filter(c => c.trim() !== '');
      const { hash } = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'createPoll',
        args: [newPollTitle, filteredCandidates]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      fetchPolls();
      setNewPollTitle('');
      setCandidates(['', '']);
    } catch (error) {
      console.error('Failed to create poll:', error);
    }
    setIsLoading(false);
  };

  // Vote in a poll
  const vote = async (pollId, candidateId) => {
    if (!connected) return;
    setIsLoading(true);
    try {
      const { hash } = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'vote',
        args: [pollId, candidateId]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      fetchPolls();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
    setIsLoading(false);
  };

  // Fetch all polls
  const fetchPolls = async () => {
    try {
      const pollCount = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getPollCount'
      });
      
      const pollsData = await Promise.all(
        Array.from({ length: Number(pollCount) }, (_, i) => 
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getPoll',
            args: [i]
          })
        )
      );
      
      setPolls(pollsData.map((poll, index) => ({
        id: index,
        title: poll[0],
        isActive: poll[1],
        candidates: poll[2].map((name, idx) => ({
          name,
          votes: Number(poll[3][idx])
        }))
      })));
    } catch (error) {
      console.error('Failed to fetch polls:', error);
    }
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
                <span className={`px-3 py-1 rounded-full text-sm ${
                  poll.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {poll.isActive ? 'Active' : 'Ended'}
                </span>
              </div>
              <div className="space-y-4">
                {poll.candidates.map((candidate, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700">{candidate.name}</span>
                      <span className="text-sm text-gray-500">{candidate.votes} votes</span>
                    </div>
                    <div className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${(candidate.votes / Math.max(...poll.candidates.map(c => c.votes), 1)) * 100}%`
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
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}