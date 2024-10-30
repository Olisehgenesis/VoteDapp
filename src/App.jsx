import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { mainnet } from 'viem/chains';

import CONTRACT_ABI from "./contracts/vote.abi.json";

const CONTRACT_ADDRESS = '0x38E061a6254c846408d06315216E65281185BEdF';

export default function VotingApp() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPollTitle, setNewPollTitle] = useState('');
  const [newCandidates, setNewCandidates] = useState(['', '']);
  const [creating, setCreating] = useState(false);
  const [voting, setVoting] = useState(false);
  const [account, setAccount] = useState(null);
  const [publicClient, setPublicClient] = useState(null);
  const [walletClient, setWalletClient] = useState(null);

  // Initialize clients
  useEffect(() => {
    const public_client = createPublicClient({
      chain: mainnet,
      transport: http()
    });

    setPublicClient(public_client);

    if (typeof window.ethereum !== 'undefined') {
      const wallet_client = createWalletClient({
        chain: mainnet,
        transport: custom(window.ethereum)
      });
      setWalletClient(wallet_client);
    }
  }, []);

  async function connectWallet() {
    try {
      if (!walletClient) {
        throw new Error('Please install MetaMask');
      }
      const [address] = await walletClient.requestAddresses();
      setAccount(address);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadPolls() {
    if (!publicClient) return;

    try {
      setLoading(true);
      const pollCount = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getPollCount'
      });

      const loadedPolls = [];
      for (let i = 0; i < Number(pollCount); i++) {
        const [title, isActive, candidateNames, voteCounts] = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getPoll',
          args: [i]
        });

        const candidates = candidateNames.map((name, index) => ({
          name,
          votes: Number(voteCounts[index])
        }));

        loadedPolls.push({
          id: i,
          title,
          isActive,
          candidates
        });
      }
      
      setPolls(loadedPolls);
    } catch (err) {
      setError("Failed to load polls: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (publicClient) {
      loadPolls();
    }
  }, [publicClient]);

  async function createPoll(e) {
    e.preventDefault();
    if (!walletClient || !account) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setCreating(true);
      const filteredCandidates = newCandidates.filter(c => c.trim() !== '');
      
      const { request } = await publicClient.simulateContract({
        account,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'createPoll',
        args: [newPollTitle, filteredCandidates]
      });
      
      await walletClient.writeContract(request);
      
      setNewPollTitle('');
      setNewCandidates(['', '']);
      await loadPolls();
    } catch (err) {
      setError("Failed to create poll: " + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function vote(pollId, candidateId) {
    if (!walletClient || !account) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setVoting(true);
      
      const { request } = await publicClient.simulateContract({
        account,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'vote',
        args: [pollId, candidateId]
      });
      
      await walletClient.writeContract(request);
      
      await loadPolls();
    } catch (err) {
      setError("Failed to vote: " + err.message);
    } finally {
      setVoting(false);
    }
  }

  async function endPoll(pollId) {
    if (!walletClient || !account) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      const { request } = await publicClient.simulateContract({
        account,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'endPoll',
        args: [pollId]
      });
      
      await walletClient.writeContract(request);
      
      await loadPolls();
    } catch (err) {
      setError("Failed to end poll: " + err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin border-t-4 border-blue-500 border-solid rounded-full h-12 w-12"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Decentralized Voting</h1>
        <button 
          onClick={connectWallet}
          disabled={!!account}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400 hover:bg-blue-600"
        >
          {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Create New Poll */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Create New Poll</h2>
        <form onSubmit={createPoll} className="space-y-4">
          <div>
            <label className="block mb-2">Poll Title</label>
            <input
              type="text"
              value={newPollTitle}
              onChange={(e) => setNewPollTitle(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div>
            <label className="block mb-2">Candidates</label>
            {newCandidates.map((candidate, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={candidate}
                  onChange={(e) => {
                    const updated = [...newCandidates];
                    updated[index] = e.target.value;
                    setNewCandidates(updated);
                  }}
                  className="flex-1 p-2 border rounded"
                  placeholder={`Candidate ${index + 1}`}
                  required
                />
                {index > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewCandidates(newCandidates.filter((_, i) => i !== index));
                    }}
                    className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setNewCandidates([...newCandidates, ''])}
              className="mt-2 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              + Add Candidate
            </button>
          </div>
          
          <button 
            type="submit" 
            disabled={creating || !account}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400 hover:bg-blue-600"
          >
            {creating ? 'Creating...' : 'Create Poll'}
          </button>
        </form>
      </div>

      {/* Active Polls */}
      <div>
        <h2 className="text-xl font-bold mb-4">Active Polls</h2>
        <div className="space-y-4">
          {polls.map(poll => (
            <div key={poll.id} className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold mb-4">{poll.title}</h3>
              <div className="space-y-3">
                {poll.candidates.map((candidate, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{candidate.name}</span>
                      <span className="ml-4 text-gray-600">
                        {candidate.votes} votes ({poll.candidates.reduce((total, c) => total + c.votes, 0) > 0 
                          ? ((candidate.votes / poll.candidates.reduce((total, c) => total + c.votes, 0)) * 100).toFixed(1)
                          : '0'}%)
                      </span>
                    </div>
                    {poll.isActive && (
                      <button 
                        onClick={() => vote(poll.id, index)}
                        disabled={voting || !account}
                        className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-400 hover:bg-green-600"
                      >
                        {voting ? 'Voting...' : 'Vote'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <span className={poll.isActive ? 'text-green-600' : 'text-red-600'}>
                  Status: {poll.isActive ? 'Active' : 'Ended'}
                </span>
                {poll.isActive && (
                  <button 
                    onClick={() => endPoll(poll.id)}
                    disabled={!account}
                    className="px-4 py-2 bg-gray-500 text-white rounded disabled:bg-gray-400 hover:bg-gray-600"
                  >
                    End Poll
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {polls.length === 0 && (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow-md">
              No polls created yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}