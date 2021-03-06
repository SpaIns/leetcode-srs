const List = require('../../models/Lists.js')
const User = require('../../models/User')
const Problem = require('../../models/Problem')

const express = require('express')
const { check, validationResult } = require('express-validator')
const auth = require('../../middleware/auth')
const mongoose = require('mongoose')
const {sortStatusByNextSubmission, getSortedInsertionIndex} = require('../../utility/utility')
const {addColorToProblemsBasedOnTON} = require('../../utility/problemStatuses')

const router = express.Router()
// TODO: Consider refractoring some of the non-middleware checks
// into functions - this should reduce duplicate code and make for
// less overall test cases

// @route  GET api/lists
// @desc   Get all public Lists
// @access Public
router.get('/', async (req, res) => {
    try {
        const lists =  await List.find({public: true})
        if (!lists || lists.length === 0) {
            return res.status(404).json({errors: [{msg: 'No lists found.'}]})
        }
        return res.json(lists)
    } catch (error) {
        console.error('Get all public lists: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  GET api/lists/own
// @desc   Get all Lists user has created
// @access Private
router.get('/own', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        const lists = await List.find({creator: user._id})
        if (!lists || lists.length === 0) {
            return res.status(404).json({errors: [{msg: 'You do not own any lists.'}]})
        }
        return res.json(lists)
    } catch (error) {
        console.error('Get all of logged in user\'s lists: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})


// @route  GET api/lists/public/id/:id
// @desc   Get a public list by ID
// @access Public
router.get('/public/id/:id', async (req, res) => {
    try {
        const list = await List.findById(req.params.id)
        if (!list) {
            return res.status(404).json({errors: [{msg: 'List not found.'}]})
        }
        // Ensure list is public
        if (!list.public) {
            // Send not found response to mask that list exists to un-auth'd user
            return res.status(404).json({errors: [{msg: 'List not found.'}]})
        }
        return res.json(list)
    } catch (error) {
        console.error('Get a public list: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  GET api/lists/public/search/:term
// @desc   Get public lists matching search term
// @access Public
router.get('/public/search/:term', async (req, res) => {
    try {
        // If no term is passed, just return an empty array
        if (!req.params.term || req.params.term === '') {
            return res.json([])
        }
        const lists = await List.find({$and:
            [
                {public: true},
                {name: {$regex: req.params.term, $options: 'i'}},
            ]
        })
        return res.json(lists)
    } catch (error) {
        console.error('Search public lists: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  GET api/lists/private/:id
// @desc   Get a public list, or private list user owns
// @access Private 
router.get('/private/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        const list = await List.findById(req.params.id)
        if (!list) {
            return res.status(404).json({errors: [{msg: 'List not found.'}]})
        }
        // Check that list is either public or owned by user
        if (!(list.public || user._id.toString() === list.creator.toString())) {
            // Send not found response to mask that list exists to un-auth'd user
            return res.status(404).json({errors: [{msg: 'List not found.'}]})
        }
        return res.json(list)
    } catch (error) {
        console.error('Get a public or private list: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  GET /api/lists/:id/problems/:sort*?
// @desc   Retrieve all problems in a given list
// @access Private
router.get('/:id/problems/:sort*?', [auth], 
async (req, res) => {
    try {
        // Get the list with the given ID
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        const list = await List.findById(req.params.id)
        if (!list) {
            // Couldn't find a list with given ID
            return res.status(404).json({errors: [{msg: 'List not found.'}]})
        }
        // If list is a private list, ensure User owns the list
        if (!list.public) {
            if (list.creator.toString().localeCompare(req.user.id) !== 0) {
                return res.status(401).json({errors: [{msg: 'Access to List denied.'}]})
            }
            // Implicit else is we're okay to access; continue onwards
        }

        // For each problem in the list, get the problem object and
        // store it in an array
        problems = []
        for (let prob of list.problems) {
            const problem = await Problem.findById(prob._id)
            if (problem) {
                // We'll do sorted insertion such that the easier
                // problems are seen first
                const index = getSortedInsertionIndex(problems, problem.difficulty, 'difficulty')
                problems.splice(index, 0, problem)
            }
        }
        
        // Sort the problems by time to next if sort requested
        // As of now, any truthy param means sort requested
        const user = await User.findById(req.user.id)
        if (req.params.sort)  {
            // Defensive block, shouldn't hit else case unless func turned
            // public vs private
            if (user) {
                const statuses = user.problem_statuses
                // Make a lookup map for the problem->status index
                const probIdToStatus = new Map()
                for (const [index, status] of statuses.entries()) {
                    probIdToStatus.set(status.problem.toString(), status)
                }
                problems.sort((a, b) => {
                    // Try to get the status for both
                    const aStatus = probIdToStatus.get(a._id.toString())
                    const bStatus = probIdToStatus.get(b._id.toString())
                    return sortStatusByNextSubmission(aStatus, bStatus)
                })
            }
            else{
                console.log('No user associated, returning as is.')
            }
        }

        // Add color-coding to the problems list based on the time to next,
        // if the user is authenticated
        if (user) {
            problems = addColorToProblemsBasedOnTON(user, problems)
        }
        // More defensive code
        else {
            console.log('No user associated, not color-coding.')
        }
        return await res.json(problems)
    } catch (error) {
        console.log('Get all problems for list: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  POST api/lists
// @desc   Create a new list
// @access Private
router.post('/', [auth, [
    check('name', 'Lists must be named.').not().isEmpty(),
    check('public', 'Lists must be set true or false').isBoolean(),
    check('public', 'Public must be set as a bool').isBoolean(),
]], async (req, res) => {
    const validationErrors = validationResult(req)
    if (!validationErrors.isEmpty()) {
        // Failed a validation check, return our errors.
        return res.status(400).json({errors: validationErrors.array()})
    }

    // Request was validated, let's create our list
    try {
        // Since we can make multiple lists with the same name, no need to check unqiueness
        // Likewise for problems contained within
        const {
            name,
        } = req.body
        // Handle 'public' seperately to work around a bug in nyc (coverage tool)
        const pub = req.body['public']

        // Get the current user to make them the creator
        const user = await User.findById(req.user.id)

        const numberOfLists = user.lists.length
        if (numberOfLists >= 100) {
            console.log('User ' + user.name + ' already has ' + numberOfLists + ' lists.')
            // Prevent a user from owning more than 100 lists
            return res.status(401).json({errors: [{msg: 'You cannot have more than 100 lists.'}]})
        }

        const newList = new List({
            name,
            public : pub,
            creator: user,
        })

        const list = await newList.save()
        // Add this list to the User's lists
        user.lists.push(list._id)
        await user.save()

        return res.json(list)
    } catch (error) {
        console.error('Create a new List' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  POST api/lists/copy/:id
// @desc   Copy a public list or owned private list into user's private lists
// @access Private
router.post('/copy/:id', [auth],
async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        // Get list an ensure it exists
        const list = await List.findById(req.params.id)
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }

        // Get user
        const user = await User.findById(req.user.id)

        // Ensure list is public, or owned by User
        if (!(list.public || user._id.toString() === list.creator.toString())) {
            // Send not found response to mask that list exists to un-auth'd user
            return res.status(404).json({errors: [{msg: 'List not found.'}]})
        }

        // Make a copy of the list
        const copyList = new List({
            name: list.name,
            public: false,
            problems: list.problems,
            creator: user
        })

        // Save the copy list
        const newList = await copyList.save()
        user.lists.push(newList._id)
        await user.save()

        return res.json(newList)
    } catch (error) {
        console.error('Copy a list: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// // @route  PUT api/lists/:id
// // @desc   Update an existing list's non-Problem attributes
// // @access Private
router.put('/:id', [auth],
async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        const list = await List.findById(req.params.id)
        // Ensure our list exists
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }

        const user = await User.findById(req.user.id)
        // Ensure that this user owns the list
        if (user._id.toString() != list.creator.toString()) {
            return res.status(401).json({errors: [{msg: 'Cannot update a list you did not create.'}]})
        }
        // Ensure list isn't public - cannot rename a public list, or take private
        if (list.public) {
            return res.status(403).json({errors: [{msg: 'Cannot update a public list\'s non-problem attributes.'}]})
        }

        const {
            name,
        } = req.body
        // Handle 'public' seperately to work around a bug in nyc (coverage tool)
        const pub = req.body['public']

        // Update the list
        if (name) {list.name = name}
        if (pub) {list.public = pub}

        // Save the updated list
        const updatedList = await list.save()
        return res.json(updatedList)
    } catch (error) {
        console.error('Update list attributes: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  PUT api/lists/add/list_id/problem_id
// @desc   Add a problem to a list
// @access Private
router.put('/add/:list_id/:problem_id', [auth],
async (req, res) => {
    try {
        // Get the list
        if (!mongoose.Types.ObjectId.isValid(req.params.list_id)) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        const list = await List.findById(req.params.list_id)
        // Ensure the list exists
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        // Ensure it's created by user
        const user = await User.findById(req.user.id)
        if (list.creator.toString() != user._id.toString()) {
            return res.status(401).json({errors: [{msg: 'Cannot add to a list you did not create.'}]})
        }
        // Get problem
        const problem = await Problem.findOne({id: req.params.problem_id})
        // Ensure problem exists
        if (!problem) {
            return res.status(404).send({errors: [{msg: 'Problem not found.'}]})
        }
        // Ensure not already in list
        const inList = list.problems.find((curProb) => {
            return curProb._id.toString() === problem._id.toString()
        })
        if (inList) {
            // Already a part of the list, can't add twice.
            return res.status(409).json({errors: [{msg: 'Problem already a part of this list.'}]})
        }
        // Attach to list
        list.problems.push(problem)
        
        // Update our list
        updatedList = await list.save()
        return res.json(updatedList)
    } catch (error) {
        console.error('Add problem to list: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  PUT api/lists/remove/list_id/problem_id
// @desc   Remove a problem from a list
// @access Private
router.put('/remove/:list_id/:problem_id', [auth],
async (req, res) => {
    try {
        // Get the list
        if (!mongoose.Types.ObjectId.isValid(req.params.list_id)) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        const list = await List.findById(req.params.list_id)
        // Ensure the list exists
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        // Ensure it's created by user
        const user = await User.findById(req.user.id)
        if (list.creator.toString() != user._id.toString()) {
            return res.status(401).json({errors: [{msg: 'Cannot delete from a list you did not create.'}]})
        }
        // Get problem
        const problem = await Problem.findOne({id: req.params.problem_id})
        // Ensure problem exists
        if (!problem) {
            return res.status(404).send({errors: [{msg: 'Problem not found.'}]})
        }
        // Ensure problem is part of the list
        const index = list.problems.map(curProb=> curProb._id.toString() ).indexOf(problem._id.toString())
        if (index === -1) {
            // Not in the list, can't remove it
            return res.status(404).json({errors: [{msg: 'Problem not part of this list.'}]})
        }
        // Remove from the list
        list.problems.splice(index, 1)
        
        // Update our list
        updatedList = await list.save()
        return res.json(updatedList)
    } catch (error) {
        console.error('Remove problem from list: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  PUT api/lists/bulk/list_id
// @desc   Changes the status of a bulk list of problems
// @access Private
// @input  Array of JSON objects, each with 'id' and 'add' field
router.put('/bulk/:list_id', [auth, [
    check('problems', 'Must provide problems to update list with').not().isEmpty(),
    check('problems', 'Must provide array of problem IDs').isArray(),
    check('problems.*.id', 'All problems must have an ID').not().isEmpty(),
    check('problems.*.id', 'All problem IDs must be a valid MongoID').isMongoId(),
    check('problems.*.add', 'All problems must declare if we\'re adding or removing.').not().isEmpty(),
    check('problems.*.add', 'All problems must provide bool for adding.').isBoolean(),
]],
async (req, res) => {
    const validationErrors = validationResult(req)
    if (!validationErrors.isEmpty()) {
        // Failed a validation check, return our errors.
        return res.status(400).json({errors: validationErrors.array()})
    }
    try {
        // Get the list
        if (!mongoose.Types.ObjectId.isValid(req.params.list_id)) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        const list = await List.findById(req.params.list_id)
        // Ensure the list exists
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        // Ensure it's created by user
        const user = await User.findById(req.user.id)
        if (list.creator.toString() != user._id.toString()) {
            return res.status(401).json({errors: [{msg: 'Cannot update a list you did not create.'}]})
        }
        // For each problem:
        const {
            problems
        } = req.body

        // Keep track of any additions/removals that fail
        // over the course of our bulk update
        const failed_updates = []
        for (let i = 0; i < problems.length; i++) {
            const problem_info = problems[i]
            const id = problem_info['id']
            const adding = problem_info['add']
            // Get the problem
            const problem = await Problem.findById(id)

            // Ensure problem exists
            if (!problem) {
                failed_updates.push('Could not find problem with ID ' + id)
                continue
            }

            // Add to list
            if (adding) {
                // Ensure not already in list
                const inList = list.problems.find((curProb) => {
                    return curProb._id.toString() === problem._id.toString()
                })
                if (inList) {
                    // Already a part of the list, can't add twice.
                    failed_updates.push('Problem already part of list: ID ' + id)
                    continue
                }
                // Attach to list
                list.problems.push(problem)
            }
            // Remove from list
            else {
                const index = list.problems.map(curProb=> curProb._id.toString() ).indexOf(problem._id.toString())
                if (index === -1) {
                    // Not in the list, can't remove it
                    failed_updates.push('Problem not part of list: ID ' + id)
                    continue
                }
                // Remove from the list
                list.problems.splice(index, 1)
            }
        }
        
        // Update our list
        updatedList = await list.save()
        // Return both the update list and any failed updates
        return res.json({
            list: updatedList,
            errors: failed_updates
        })
    } catch (error) {
        console.error("Bulk list update error: " + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})

// @route  DELETE api/lists/id
// @desc   Delete an existing list
// @access Private
router.delete('/:id', [auth],
async (req, res) => {
    try {
        // Get our User object
        const user = await User.findById(req.user.id)
        // Get our List object
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        const list = await List.findById(req.params.id)

        // Ensure our list exists
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        
        // Check that this list belongs to the user
        if (user._id.toString() !== list.creator.toString()) {
            return res.status(401).json({errors: [{msg: 'Cannot delete a list you did not create.'}]})
        }
        // Check that this list is not public
        if (list.public) {
            // Do not allow deletion of public lists.
            // Other users may have this list in their list of lists, so
            // we want to ensure that we don't suddenly erase it from them.
            // Return forbidden request
            return res.status(403).json({errors: [{msg: 'Cannot delete a public list.'}]})
        }

        // Remove the list 
        await list.remove()
        // Remove the list from the User's lists
        const index = user.lists.map(curList => curList._id.toString()).indexOf(req.params.id)
        if (index === -1) {
            // This list isn't part of the user's lists
            // This should never be hit.
            console.log('Hit a statement we should never hit.')
            console.log('Check out how we hit a list not in user\'s lists when deleting list')
            console.log('User: ' + user._id)
            console.log('List:' + req.params.id)
            return res.status(404).json({errors: [{msg: 'List not a part of user\'s Lists.'}]})
        }
        // Remove the list from the lists array
        user.lists.splice(index, 1)
        await user.save()

        return res.json({msg: 'List removed'})
    } catch (error) {
        console.error('Delete list: ' + error.message)
        return res.status(500).json({errors: [ {msg: 'Server error.'}]})
    }
})


module.exports = router