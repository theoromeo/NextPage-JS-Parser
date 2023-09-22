import Definitions from "./util/Definitions.js"
import Informational from "./util/Informational.js"
import { DOMParser , XMLSerializer } from 'xmldom-qsa'
import BasicView from "./views/BasicView.js"
import ArticleView from "./views/ArticleView.js"
import ImageView from "./views/ImageView.js"
import ImageGridView from "./views/ImageGridView.js"
import QueryOperators from "./util/QueryOperators.js"
export default class NextPage
{
    ViewTypes = {}

    constructor()
    {
        this.ViewTypes[BasicView.name] = BasicView
        this.ViewTypes[ArticleView.name] = ArticleView
        this.ViewTypes[ImageView.name] = ImageView
        this.ViewTypes[ImageGridView.name] = ImageGridView
    }

    /**
     * Get node from webpage.
     * 
     * @param {URL} url - URL of webpage to retrieve.
     * @param {String} key - Node to look for on webpage
     * @returns 
     */
    async get(url,key)
    {
        const webpageResponse = await this.getWebpage(url)
        
        if(webpageResponse instanceof Number)
        return -1

        const DOM = this.toDOM(webpageResponse)

        if(DOM instanceof Number)
        return -2

        const node = this.getNode(DOM,key)

        if(node instanceof Number)
        return -3

        const viewInformation = this.getViewInformation(node)

        if(viewInformation instanceof Number)
        return -4

        const viewData = this.getQueryData(viewInformation,node,DOM)

        return viewData


    }

    /**
     * Gets Webpage for parsing.
     * 
     * @param {URL} url - URL of webpage to retrieve.
     * @returns {(String|Number)} 
     * - HTML if webpage retrieved successfully, 
     * - -1 if fetch error, 
     * - -2 if connection error.
     */
    async getWebpage(url)
    {
        let webpageResponse = null;
        
        try 
        {
            const request = await fetch(url)

            if(!request.ok)
            {
                return -2;
            }

            webpageResponse = await request.text()
        } 
        catch (error) 
        {
            return -1
        }

        return webpageResponse;
    }

    /**
     * Convert HTML string to DOM object
     * 
     * @param {String} html - String of html
     * @returns {(Object|Number)}
     * - Document Object
     * - -1 if parsing error
     */
    toDOM(html)
    {
        const page = new DOMParser
        ({  locator: {},
            errorHandler: { warning: function (w) { }, 
            error: function (e) { }, 
            fatalError: function (e) { console.error(e) } }
        }).parseFromString(html,"text/xml");

        if(!page)
        return -1

        return page
    }

    /**
     * Gets defined node from DOM.
     * 
     * @param {Document} DOM - Document of parsed webpage.
     * @param {String} key - Node lookup string for 'np-for' property.
     * @returns {(Node|Number)}
     * - Node if node found
     * - -1 if node not found
     */
    getNode(DOM,key)
    {
        let node = DOM.querySelectorAll(`[np-for="${key}"]`)
        if(node.length < 1 )
        return -1

        if(node.length > 1)
        console.warn(`More then 1 node found with np-for="${key}" using first instance.`)

        return this.removeChildNodes(node[0])

    }

    /**
     * Remove nested defined nodes
     * 
     * @param {Node} node 
     * @return {Node} - cleared root node
     */
    removeChildNodes(node)
    {
        let children = node.querySelectorAll(`[${Definitions.for}]`)

        children.forEach(subNode => {
            node.removeChild(subNode)
        });

        return node
    }


    /**
     * Retrieves the query string and view type defined by the node.
     * 
     * @param {Node} node - Root node
     * @returns {(object|Number)}
     * - object {type,query}
     * - -1 No view defined on node
     * - -2 Type not valid
     */
    getViewInformation(node)
    {
        if(!node.nodeType)
        return -1

        let viewProperty = node.getAttribute(Definitions.view)

        if(!viewProperty)
        return -2

        let type = this.getViewType(viewProperty)

        if(!type)
        return -3

        let query = this.getViewQuery(viewProperty,node)

        return {
            type:type,
            query: query
        }
    }


    /**
     * @param {String} propertyValue - string from defined np-view property 
     * @returns {(String|Boolean)}
     * - string if valid view type
     * - false if invalid
     */
    getViewType(propertyValue)
    {
        let type = propertyValue.trim()


        if(propertyValue.includes(QueryOperators.global))
        type = propertyValue.split(QueryOperators.global)[0].trim()

        else if(propertyValue.includes(QueryOperators.local))
        type = propertyValue.split(QueryOperators.local)[0].trim()


        if(this.ViewTypes[type])
            return type.trim()

        return false
    } 


    /**
     * @param {String} propertyValue - string from defined np-view property 
     * @param {Node} node - Root Node
     * @returns {(String)}
     * - String Query string
     * - 'tagged' if node uses tags
     */
    getViewQuery(propertyValue,node)
    {   
        let query = ''

        // Custom global query 
        if(propertyValue.includes(QueryOperators.global))
        return QueryOperators.global+propertyValue.replace(QueryOperators.global,"|").split("|")[1].trim()

        // Custom local query
        if(propertyValue.includes(QueryOperators.local))
        return propertyValue.replace(QueryOperators.local,"|").split("|")[1].trim()

        // By tag
        query = this.isViewQueryTagged(propertyValue.trim(),node)
        if(query)
        return "tagged"

        // Get default query 
        return this.ViewTypes[propertyValue.trim()].default
    }

    /**
     * Returns true if node defines properties by tag
     * 
     * @param {String} type - View type
     * @param {Node} node - Node
     * @returns {Boolean}
     */
    isViewQueryTagged(type,node)
    {
        let result = this.ViewTypes[type].tagged(node)

        if(!result)
            return false

        return result
    }


    /**
     * @param {Object} info - object containing query and view type
     * @param {Node} node - root node 
     * @param {Node} DOM - Whole webpage node for custom view queries
     * @returns {Object}
     */
    getQueryData(info,node,DOM)
    {
        let result

        if(!DOM.nodeType)
        return -1

        if(!node.nodeType)
        return -2

        const query = info.query

        if(!query)
        result = this.getHeaderProperties(DOM)

        if(result instanceof Number)
        return -3

        else if(query == "tagged")
        result = this.ViewTypes[info.type].tagged(node)

        else 
        result = this.executeQuery(info.type,query,node,DOM)

        // Get Basic properties from result query
        const basics = this.getBasicPropertiesForNode(node)

        // if(info.view == "article")
        result = {...result,...basics}

        result = this.addFallbackProperties(result,DOM)

        return result
    }

    /**
     * 
     * @param {Document} DOM - webpage dom
     * @returns {(object|Number)} 
     * - Object containing the title, description and icon
     * - -1 if no head found in dom
     * - -2 if title or description was empty
     */
    getHeaderProperties(DOM)
    {
        const head = DOM.querySelector("head")
        // if(!head)
        // return -1

        const icon = this.getFallbackIcon(head)
        const title = this.getFallbackTitle(head)
        const description = this.getFallbackDescription(head)
        
        return {icon:icon,title:title,description:description}
    }

    executeQuery(type,query,node,DOM)
    {
        let targetNode = node;
        let activeQuery = query
        let filteredResults

        if(query.startsWith(QueryOperators.global))
        {
            targetNode = DOM
            activeQuery = query.slice(2)
        }
        
        let queryResult


        if(activeQuery.trim() != "")
        queryResult = targetNode.querySelectorAll(activeQuery)
        

        if(!queryResult)
        filteredResults = false

        else 
        filteredResults = this.ViewTypes[type].filter(queryResult)

        let result = {type:type,result:filteredResults}
        return result

    }


    getBasicPropertiesForNode(node)
    {
        const titleElement = node.querySelector(`[${Informational.title}]`)
        const descriptionElement = node.querySelector(`[${Informational.description}]`)
        const iconElement = node.querySelector(`[${Informational.icon}]`)

        let titleValue = false,
        descriptionValue=false,
        iconValue =false

        if(titleElement)
        {
            let value =  titleElement.getAttribute(Informational.title)

            if(value != Informational.title && value.trim != "")
            titleValue = value

            else
            {
                value = titleElement.textContent

                if(value.trim != "")
                titleValue = value
            }
        }

        if(descriptionElement)
        {
            let value =  descriptionElement.getAttribute(Informational.description)

            if(value != Informational.description && value.trim != "")
            descriptionValue = value

            else
            {
                value = descriptionElement.textContent

                if(value.trim != "")
                descriptionValue = value
            }
        }

        if(iconElement)
        {
            let value =  iconElement.getAttribute(Informational.icon)

            if(value != Informational.icon && value.trim != "")
            iconValue = value
        }

        let result = []

        if(titleValue)
        result.title = titleValue

        if(descriptionValue)
        result.description = descriptionValue

        if(iconValue)
        result.icon = iconValue

        return result
    }

    /**
     * 
     * @param {object} element - View results
     * @param {string} dom - Webpage string
     * @returns {(Object|Number)}
     * - Properties with fallbacks
     * - -1 if dom passed did not contain head tag
     */
    addFallbackProperties(preResults, DOM)
    {
        const head = DOM.querySelector("head")
        if(!head)
        return -2

        let result = preResults

        if(!result.title)
        {
            result.title = this.getFallbackTitle(head)
        }

        if(!result.description)
        {
            result.description = this.getFallbackDescription(head)
        }

        if(!result.icon)
        {
            result.icon = this.getFallbackIcon(head)
        }

        return result
    }
    /**
     * @param {Node} head 
     * @returns {String} Fallback value
     */
    getFallbackTitle(head)
    {
        let title = head.querySelector(`meta[name="${Informational.title}"]`)

        if(title)
        title = title.getAttribute('content')
        
        if(!title)
        title = head.getElementsByTagName("title")[0].textContent
        
        if(!title)
        return false

        return title


    }

    /**
     * @param {Node} head 
     * @returns {String} Fallback value
     */
    getFallbackDescription(head)
    {
        let description = head.querySelector(`meta[name="${Informational.description}"]`)

        if(description)
        description = description.getAttribute('content')
        
        if(!description)
        return false

        return description
    }
    
    /**
     * @param {Node} head 
     * @returns {String} Fallback value
     */   
    getFallbackIcon(head)
    {        
        let icon = head.querySelector(`meta[name="${Informational.icon}"]`)
        
        if(icon)
        icon = icon.getAttribute('content')

        if(!icon)
        icon = head.querySelector(`link[rel="icon"]`)
        
        if(icon)
        icon = icon.getAttribute('href')
        
        if(!icon)
        return false

        return icon
    }
}