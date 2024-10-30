// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleVoting {
    // Represents a Candidate in a poll
    struct Candidate {
        string name;      // Name of the candidate
        uint256 voteCount; // Number of votes the candidate has received
    }
    
    // Represents a Poll with a title and a list of candidates
    struct Poll {
        string title;        // Title of the poll
        Candidate[] candidates; // Array of candidates participating in the poll
        bool isActive;       // Status of the poll (active or ended)
    }

    // Array to store all polls
    Poll[] public polls;
    
    // Events to log actions for external monitoring
    event PollCreated(uint256 pollId, string title);
    event Voted(uint256 pollId, uint256 candidateId);

    // Function to create a new poll with a title and list of candidate names
    function createPoll(string memory _title, string[] memory _candidateNames) public returns (uint256) {
        Poll storage newPoll = polls.push(); // Add a new poll to the array
        newPoll.title = _title;              // Set the poll title
        newPoll.isActive = true;             // Set the poll as active
        
        // Add candidates to the poll
        for (uint i = 0; i < _candidateNames.length; i++) {
            newPoll.candidates.push(Candidate({
                name: _candidateNames[i],    // Candidate name
                voteCount: 0                 // Initial vote count
            }));
        }
        
        emit PollCreated(polls.length - 1, _title); // Emit poll creation event
        return polls.length - 1;                    // Return poll ID
    }
    
    // Function to vote for a candidate in a specific poll
    function vote(uint256 _pollId, uint256 _candidateId) public {
        require(_pollId < polls.length, "Poll does not exist"); // Check poll exists
        require(polls[_pollId].isActive, "Poll is not active"); // Check poll is active
        require(_candidateId < polls[_pollId].candidates.length, "Candidate does not exist"); // Check candidate exists
        
        polls[_pollId].candidates[_candidateId].voteCount++;    // Increment vote count
        emit Voted(_pollId, _candidateId);                      // Emit vote event
    }
    
    // Function to end an active poll
    function endPoll(uint256 _pollId) public {
        require(_pollId < polls.length, "Poll does not exist"); // Check poll exists
        polls[_pollId].isActive = false;                        // Set poll to inactive
    }
    
    // Function to get details of a specific poll
    function getPoll(uint256 _pollId) public view returns (
        string memory title,
        bool isActive,
        string[] memory candidateNames,
        uint256[] memory voteCounts
    ) {
        require(_pollId < polls.length, "Poll does not exist"); // Check poll exists
        
        Poll storage poll = polls[_pollId];
        title = poll.title;                                     // Get poll title
        isActive = poll.isActive;                               // Get poll status
        
        candidateNames = new string[](poll.candidates.length);  // Array for candidate names
        voteCounts = new uint256[](poll.candidates.length);     // Array for vote counts
        
        for (uint i = 0; i < poll.candidates.length; i++) {
            candidateNames[i] = poll.candidates[i].name;        // Store candidate names
            voteCounts[i] = poll.candidates[i].voteCount;       // Store vote counts
        }
    }
    
    // Function to get the total number of polls
    function getPollCount() public view returns (uint256) {
        return polls.length;                                    // Return poll count
    }
}
