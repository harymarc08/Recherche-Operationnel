"use client";
import React, { useState, useCallback, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  Node,
  Edge,
  Controls,
  Background,
  MarkerType,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

// Interface pour représenter un graphe
interface GraphData {
  [key: string]: { [key: string]: number };
}

// Algorithme de Dijkstra pour trouver le chemin max
function dijkstraMaxDistance(
  graph: GraphData,
  startNode: string,
  endNode?: string
): {
  distances: { [key: string]: number };
  path?: string[];
} {
  const distances: { [key: string]: number } = {};
  const previous: { [key: string]: string | null } = {};

  // Initialisation
  Object.keys(graph).forEach((node) => {
    distances[node] = -Infinity;
    previous[node] = null;
  });
  distances[startNode] = 0;

  const unvisitedNodes = new Set(Object.keys(graph));

  while (unvisitedNodes.size > 0) {
    // Trouver le nœud non visité avec la distance maximale
    let currentNode = Array.from(unvisitedNodes).reduce((maxNode, node) =>
      distances[node] > distances[maxNode] ? node : maxNode
    );

    // Arrêter si on a atteint le nœud de destination
    if (endNode && currentNode === endNode) break;

    unvisitedNodes.delete(currentNode);

    // Mettre à jour les distances des voisins
    Object.entries(graph[currentNode] || {}).forEach(([neighbor, weight]) => {
      if (unvisitedNodes.has(neighbor)) {
        const newDistance = distances[currentNode] + weight;
        if (newDistance > distances[neighbor]) {
          distances[neighbor] = newDistance;
          previous[neighbor] = currentNode;
        }
      }
    });
  }

  // Reconstruire le chemin si un nœud de destination est spécifié
  let path: string[] | undefined;
  if (endNode) {
    path = [];
    let current = endNode;
    while (current && previous[current]) {
      path.unshift(current);
      current = previous[current] || "";
      if (current === startNode) {
        path.unshift(current);
        break;
      }
    }
    // Si le chemin ne commence pas par le nœud de départ, le chemin n'existe pas
    if (path[0] !== startNode) {
      path = undefined;
    }
  }

  return { distances, path };
}

// Composant modal pour modifier les arcs
interface EdgeModalProps {
  isOpen: boolean;
  edge: { source: string; target: string; weight: number } | null;
  onClose: () => void;
  onSave: (
    source: string,
    target: string,
    weight: number,
    oldSource?: string,
    oldTarget?: string
  ) => void;
  nodes: Node[];
}

const EdgeModal: React.FC<EdgeModalProps> = ({
  isOpen,
  edge,
  onClose,
  onSave,
  nodes,
}) => {
  const [source, setSource] = useState<string>(edge?.source || "");
  const [target, setTarget] = useState<string>(edge?.target || "");
  const [weight, setWeight] = useState<number>(edge?.weight || 1);

  useEffect(() => {
    if (edge) {
      setSource(edge.source);
      setTarget(edge.target);
      setWeight(edge.weight);
    }
  }, [edge]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-sky-900/60 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-96 max-w-lg">
        <h2 className="text-xl font-bold mb-4 text-sky-800 border-b pb-2">
          {edge ? "Modifier un arc" : "Ajouter un arc"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block mb-1 font-medium text-gray-700">
              Source:
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-gray-900"
            >
              <option value="">Sélectionner une source</option>
              {nodes.map((node) => (
                <option key={`source-${node.id}`} value={node.id}>
                  {node.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium text-gray-700">
              Destination:
            </label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-gray-900"
            >
              <option value="">Sélectionner une destination</option>
              {nodes.map((node) => (
                <option key={`target-${node.id}`} value={node.id}>
                  {node.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium text-gray-700">
              Poids:
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-gray-900"
              min="1"
            />
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                if (source && target && weight > 0) {
                  onSave(source, target, weight, edge?.source, edge?.target);
                  onClose();
                }
              }}
              className="bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors shadow-sm"
              disabled={!source || !target || weight <= 0}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant modal pour ajouter/modifier un nœud
interface NodeModalProps {
  isOpen: boolean;
  node: Node | null;
  onClose: () => void;
  onSave: (id: string, x: number, y: number, oldId?: string) => void;
}

const NodeModal: React.FC<NodeModalProps> = ({
  isOpen,
  node,
  onClose,
  onSave,
}) => {
  const [id, setId] = useState<string>(node?.id || "");
  const [x, setX] = useState<number>(node?.position.x || 100);
  const [y, setY] = useState<number>(node?.position.y || 100);

  useEffect(() => {
    if (node) {
      setId(node.id);
      setX(node.position.x);
      setY(node.position.y);
    } else {
      setId("");
      setX(100);
      setY(100);
    }
  }, [node]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-sky-900/60 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-96 max-w-lg">
        <h2 className="text-xl font-bold mb-4 text-sky-800 border-b pb-2">
          {node ? "Modifier un nœud" : "Ajouter un nœud"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block mb-1 font-medium text-gray-700">ID:</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-gray-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium text-gray-700">
                Position X:
              </label>
              <input
                type="number"
                value={x}
                onChange={(e) => setX(Number(e.target.value))}
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-gray-900"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-700">
                Position Y:
              </label>
              <input
                type="number"
                value={y}
                onChange={(e) => setY(Number(e.target.value))}
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-gray-900"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                if (id) {
                  onSave(id, x, y, node?.id);
                  onClose();
                }
              }}
              className="bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors shadow-sm"
              disabled={!id}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant pour afficher les instructions
interface InstructionsPanelProps {
  onClose: () => void;
}

const InstructionsPanel = ({ onClose }: InstructionsPanelProps) => {
  return (
    <div className="fixed inset-0 bg-sky-900/60 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-3/4 max-w-2xl max-h-3/4 overflow-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-bold text-sky-800">
            Guide d'utilisation
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="space-y-4 text-gray-700">
          <div>
            <h3 className="font-semibold text-sky-700">
              Qu'est-ce que l'algorithme de Dijkstra modifié?
            </h3>
            <p>
              Cette application utilise une version modifiée de l'algorithme de
              Dijkstra pour trouver le chemin de poids maximal entre deux nœuds
              d'un graphe orienté et pondéré.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-sky-700">
              Comment utiliser cette application?
            </h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Créez votre graphe en ajoutant des nœuds et des arcs</li>
              <li>Sélectionnez un nœud de départ et un nœud d'arrivée</li>
              <li>
                Cliquez sur "Calculer" pour trouver le chemin de poids maximal
              </li>
              <li>Le résultat affichera le chemin et la distance maximale</li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold text-sky-700">Fonctionnalités</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Ajout, modification et suppression de nœuds</li>
              <li>Ajout, modification et suppression d'arcs</li>
              <li>Visualisation du graphe avec mise en évidence du chemin</li>
              <li>Calcul de la distance maximale entre deux nœuds</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ModifiableGraphPage() {
  // Définir le graphe selon l'image
  const initialGraph: GraphData = {
    A: { B: 2, C: 1, D: 4 },
    B: { E: 1, C: 2, D: 3 },
    C: { E: 4, F: 5 },
    D: { C: 3, F: 1 },
    E: { G: 5, F: 6 },
    F: { G: 2 },
    G: {},
  };

  // État pour le graphe et l'algorithme
  const [graph, setGraph] = useState<GraphData>(initialGraph);
  const [startNode, setStartNode] = useState<string>("A");
  const [endNode, setEndNode] = useState<string>("G");
  const [maxDistances, setMaxDistances] = useState<{ [key: string]: number }>(
    {}
  );
  const [path, setPath] = useState<string[] | undefined>([]);
  const [highlightPath, setHighlightPath] = useState<boolean>(false);

  // État pour les modals
  const [edgeModalOpen, setEdgeModalOpen] = useState<boolean>(false);
  const [selectedEdge, setSelectedEdge] = useState<{
    source: string;
    target: string;
    weight: number;
  } | null>(null);
  const [nodeModalOpen, setNodeModalOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  // Coordonnées des nœuds selon l'image
  const initialNodesData = [
    { id: "A", position: { x: 50, y: 160 } },
    { id: "B", position: { x: 200, y: 50 } },
    { id: "C", position: { x: 320, y: 160 } },
    { id: "D", position: { x: 170, y: 260 } },
    { id: "E", position: { x: 450, y: 50 } },
    { id: "F", position: { x: 450, y: 260 } },
    { id: "G", position: { x: 600, y: 160 } },
  ];

  // Utilisation des hooks de ReactFlow pour gérer les nœuds et les arêtes
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodesData.map((node) => ({
      ...node,
      data: { label: node.id },
      style: {
        background: "#f0f9ff",
        color: "#0369a1",
        border: "2px solid #0ea5e9",
        borderRadius: "8px",
        padding: 12,
        fontWeight: "bold",
        width: 60,
        textAlign: "center",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
      },
    }))
  );

  // Créer les arêtes initiales à partir du graphe
  const createInitialEdges = (): Edge[] => {
    const edges: Edge[] = [];
    Object.entries(graph).forEach(([source, targets]) => {
      Object.entries(targets).forEach(([target, weight], index) => {
        edges.push({
          id: `${source}-${target}-${index}`,
          source,
          target,
          label: weight.toString(),
          type: "default",
          labelStyle: { fontWeight: "bold", fill: "#1e40af" },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#0284c7",
          },
          style: { stroke: "#0284c7", strokeWidth: 2 },
          data: { weight },
        });
      });
    });
    return edges;
  };

  const [edges, setEdges, onEdgesChange] = useEdgesState(createInitialEdges());

  // Mettre à jour les arêtes lorsque le graphe change
  useEffect(() => {
    // Update edges when path changes, to highlight the path
    const updatedEdges = edges.map((edge) => {
      if (
        path &&
        path.includes(edge.source) &&
        path.includes(edge.target) &&
        path.indexOf(edge.source) === path.indexOf(edge.target) - 1
      ) {
        return {
          ...edge,
          animated: highlightPath,
          style: { stroke: "#16a34a", strokeWidth: 3 },
          labelStyle: { fontWeight: "bold", fill: "#16a34a" },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#16a34a",
          },
        };
      } else {
        return {
          ...edge,
          animated: false,
          style: { stroke: "#0284c7", strokeWidth: 2 },
          labelStyle: { fontWeight: "bold", fill: "#1e40af" },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#0284c7",
          },
        };
      }
    });
    setEdges(updatedEdges);
  }, [path, highlightPath]);

  // Calculer le chemin maximal
  const calculateMaxPath = () => {
    const result = dijkstraMaxDistance(graph, startNode, endNode);
    setMaxDistances(result.distances);
    setPath(result.path);
    setHighlightPath(true);
  };

  // Convertir les arêtes en graphe
  const edgesToGraph = (edges: Edge[]): GraphData => {
    const newGraph: GraphData = {};
    // Initialize all nodes
    nodes.forEach((node) => {
      newGraph[node.id] = {};
    });
    // Add all edges
    edges.forEach((edge) => {
      if (!newGraph[edge.source]) {
        newGraph[edge.source] = {};
      }
      newGraph[edge.source][edge.target] = Number(
        edge.data?.weight || edge.label || 1
      );
    });
    return newGraph;
  };

  // Mettre à jour le graphe lorsque les arêtes changent
  useEffect(() => {
    const newGraph = edgesToGraph(edges);
    setGraph(newGraph);
  }, [edges]);

  // Fonction pour réinitialiser le graphe
  const resetGraph = () => {
    setGraph(initialGraph);
    setNodes(
      initialNodesData.map((node) => ({
        ...node,
        data: { label: node.id },
        style: {
          background: "#f0f9ff",
          color: "#0369a1",
          border: "2px solid #0ea5e9",
          borderRadius: "8px",
          padding: 12,
          fontWeight: "bold",
          width: 60,
          textAlign: "center",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        },
      }))
    );
    setEdges(createInitialEdges());
    setMaxDistances({});
    setPath([]);
    setHighlightPath(false);
  };

  // Gestion des nœuds
  const handleAddNode = () => {
    setSelectedNode(null);
    setNodeModalOpen(true);
  };

  const handleEditNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setNodeModalOpen(true);
    }
  };

  const handleSaveNode = (id: string, x: number, y: number, oldId?: string) => {
    if (oldId && oldId !== id) {
      // Update node ID - we need to update the graph and all edges
      const newNodes = nodes.map((node) =>
        node.id === oldId
          ? {
              ...node,
              id,
              data: { label: id },
            }
          : node
      );
      setNodes(newNodes);

      // Update edges
      const newEdges = edges.map((edge) => {
        if (edge.source === oldId) {
          return { ...edge, source: id, id: `${id}-${edge.target}` };
        }
        if (edge.target === oldId) {
          return { ...edge, target: id, id: `${edge.source}-${id}` };
        }
        return edge;
      });
      setEdges(newEdges);

      // Update graph
      const newGraph: GraphData = {};
      Object.entries(graph).forEach(([source, targets]) => {
        const newSource = source === oldId ? id : source;
        newGraph[newSource] = {};
        Object.entries(targets).forEach(([target, weight]) => {
          const newTarget = target === oldId ? id : target;
          newGraph[newSource][newTarget] = weight;
        });
      });
      setGraph(newGraph);
    } else if (!oldId) {
      // Add new node
      const newNode: Node = {
        id,
        position: { x, y },
        data: { label: id },
        style: {
          background: "#f0f9ff",
          color: "#0369a1",
          border: "2px solid #0ea5e9",
          borderRadius: "8px",
          padding: 12,
          fontWeight: "bold",
          width: 60,
          textAlign: "center",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        },
      };
      setNodes((prev) => [...prev, newNode]);
      setGraph((prev) => ({ ...prev, [id]: {} }));
    } else {
      // Just update position
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id ? { ...node, position: { x, y } } : node
        )
      );
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    // Remove node
    setNodes((prev) => prev.filter((node) => node.id !== nodeId));

    // Remove all edges connected to this node
    setEdges((prev) =>
      prev.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );

    // Update graph
    const newGraph = { ...graph };
    delete newGraph[nodeId];
    Object.keys(newGraph).forEach((source) => {
      if (newGraph[source][nodeId]) {
        delete newGraph[source][nodeId];
      }
    });
    setGraph(newGraph);
  };

  // Gestion des arcs
  const handleAddEdge = () => {
    setSelectedEdge(null);
    setEdgeModalOpen(true);
  };

  const handleEditEdge = (edge: Edge) => {
    setSelectedEdge({
      source: edge.source,
      target: edge.target,
      weight: Number(edge.data?.weight || edge.label || 1),
    });
    setEdgeModalOpen(true);
  };

  const handleSaveEdge = (
    source: string,
    target: string,
    weight: number,
    oldSource?: string,
    oldTarget?: string
  ) => {
    if (oldSource && oldTarget) {
      // Editing existing edge
      if (oldSource === source && oldTarget === target) {
        // Just updating weight
        setEdges((prev) =>
          prev.map((edge) =>
            edge.source === source && edge.target === target
              ? {
                  ...edge,
                  label: weight.toString(),
                  data: { ...edge.data, weight },
                }
              : edge
          )
        );
      } else {
        // Source or target changed, remove old and add new
        setEdges((prev) => [
          ...prev.filter(
            (edge) => !(edge.source === oldSource && edge.target === oldTarget)
          ),
          {
            id: `${source}-${target}-${Date.now()}`,
            source,
            target,
            label: weight.toString(),
            type: "default",
            labelStyle: { fontWeight: "bold", fill: "#1e40af" },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#0284c7",
            },
            style: { stroke: "#0284c7", strokeWidth: 2 },
            data: { weight },
          },
        ]);
      }
    } else {
      // Adding new edge
      const newEdge: Edge = {
        id: `${source}-${target}-${Date.now()}`,
        source,
        target,
        label: weight.toString(),
        type: "default",
        labelStyle: { fontWeight: "bold", fill: "#1e40af" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#0284c7",
        },
        style: { stroke: "#0284c7", strokeWidth: 2 },
        data: { weight },
      };
      setEdges((prev) => [...prev, newEdge]);
    }
  };

  const handleDeleteEdge = (edge: Edge) => {
    setEdges((prev) => prev.filter((e) => e.id !== edge.id));
  };

  // Gestion des connexions
  const onConnect = useCallback((params: Connection) => {
    // Open modal to set weight when edge is created
    if (params.source && params.target) {
      setSelectedEdge({
        source: params.source,
        target: params.target,
        weight: 1,
      });
      setEdgeModalOpen(true);
    }
  }, []);

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h1 className="text-2xl font-bold text-sky-800">
            Algorithme de Dijkstra - Chemin Maximal
          </h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowInstructions(true)}
              className="flex items-center px-3 py-1 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2h.01a1 1 0 000-2H9z"
                  clipRule="evenodd"
                />
              </svg>
              Aide
            </button>
            <button
              onClick={resetGraph}
              className="flex items-center px-3 py-1 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Contrôles du graphe */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-sky-50 p-4 rounded-lg shadow-sm">
            <h2 className="font-semibold mb-3 text-sky-900 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Modification du graphe
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleAddNode}
                className="bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors shadow-sm flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                    clipRule="evenodd"
                  />
                </svg>
                Ajouter un nœud
              </button>
              <button
                onClick={handleAddEdge}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                  <path
                    fillRule="evenodd"
                    d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                    clipRule="evenodd"
                  />
                </svg>
                Ajouter un arc
              </button>
            </div>
          </div>

          <div className="bg-emerald-50 p-4 rounded-lg shadow-sm">
            <h2 className="font-semibold mb-3 text-emerald-900 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Calcul du chemin maximal
            </h2>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={startNode}
                onChange={(e) => setStartNode(e.target.value)}
                className="border border-emerald-300 bg-white p-2 rounded-lg text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              >
                {nodes.map((node) => (
                  <option key={`start-${node.id}`} value={node.id}>
                    Départ: {node.id}
                  </option>
                ))}
              </select>
              <select
                value={endNode}
                onChange={(e) => setEndNode(e.target.value)}
                className="border border-emerald-300 bg-white p-2 rounded-lg text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              >
                {nodes.map((node) => (
                  <option key={`end-${node.id}`} value={node.id}>
                    Arrivée: {node.id}
                  </option>
                ))}
              </select>
              <button
                onClick={calculateMaxPath}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Calculer
              </button>
            </div>
          </div>
        </div>

        {/* Résultats */}
        {path && path.length > 0 && (
          <div className="mb-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-emerald-200 shadow-sm">
            <h2 className="font-semibold mb-2 text-emerald-800 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                  clipRule="evenodd"
                />
              </svg>
              Résultats
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-emerald-100">
                <p className="text-emerald-800 font-medium mb-1">
                  Chemin maximal:
                </p>
                <div className="flex items-center flex-wrap gap-2">
                  {path.map((node, index) => (
                    <React.Fragment key={node}>
                      <span className="bg-emerald-100 text-emerald-800 font-bold py-1 px-3 rounded-lg">
                        {node}
                      </span>
                      {index < path.length - 1 && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-emerald-500"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-emerald-100">
                <p className="text-emerald-800 font-medium mb-1">
                  Distance maximale:
                </p>
                <div className="flex items-center">
                  <span className="text-3xl font-bold text-emerald-600">
                    {maxDistances[endNode]}
                  </span>
                  <span className="ml-2 text-gray-500">unités</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visualisation du graphe */}
        <div
          style={{ height: 500 }}
          className="rounded-lg overflow-hidden border border-gray-200 shadow-inner mb-6 bg-gray-50"
        >
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              nodesFocusable={true}
              edgesFocusable={true}
              nodesConnectable={true}
              onNodeClick={(_, node) => handleEditNode(node.id)}
              onEdgeClick={(_, edge) => handleEditEdge(edge)}
              connectionLineStyle={{ stroke: "#0284c7", strokeWidth: 2 }}
            >
              <Panel
                position="top-right"
                className="bg-white p-3 rounded-lg shadow-sm border border-gray-200"
              >
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Astuce:</span> Cliquez sur un
                  nœud ou un arc pour le modifier
                </p>
              </Panel>
              <Controls className="bg-white rounded-lg shadow-md border border-gray-200" />
              <Background color="#e5e7eb" gap={16} size={1} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {/* Tableaux des nœuds et arcs */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Liste des nœuds */}
          <div className="bg-sky-50 p-4 rounded-lg shadow-sm border border-sky-100">
            <h2 className="font-semibold mb-3 text-sky-800 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5z" />
                <path d="M11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Nœuds ({nodes.length})
            </h2>
            <div className="overflow-auto max-h-64 bg-white rounded-lg border border-sky-100">
              {nodes.length === 0 ? (
                <p className="p-3 text-gray-500 text-center">
                  Aucun nœud disponible
                </p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-sky-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-sky-800 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-sky-800 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-sky-800 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {nodes.map((node) => (
                      <tr
                        key={node.id}
                        className="hover:bg-sky-50 transition-colors"
                      >
                        <td className="px-4 py-2 whitespace-nowrap font-medium text-sky-700">
                          {node.id}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                          ({Math.round(node.position.x)},{" "}
                          {Math.round(node.position.y)})
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleEditNode(node.id)}
                            className="text-amber-600 hover:text-amber-800 mr-2"
                            title="Modifier"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteNode(node.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Supprimer"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Liste des arcs */}
          <div className="bg-indigo-50 p-4 rounded-lg shadow-sm border border-indigo-100">
            <h2 className="font-semibold mb-3 text-indigo-800 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Arcs ({edges.length})
            </h2>
            <div className="overflow-auto max-h-64 bg-white rounded-lg border border-indigo-100">
              {edges.length === 0 ? (
                <p className="p-3 text-gray-500 text-center">
                  Aucun arc disponible
                </p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-indigo-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                        Destination
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                        Poids
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-indigo-800 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {edges.map((edge) => (
                      <tr
                        key={edge.id}
                        className="hover:bg-indigo-50 transition-colors"
                      >
                        <td className="px-4 py-2 whitespace-nowrap font-medium text-indigo-700">
                          {edge.source}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap font-medium text-indigo-700">
                          {edge.target}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                            {edge.data?.weight || edge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleEditEdge(edge)}
                            className="text-amber-600 hover:text-amber-800 mr-2"
                            title="Modifier"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteEdge(edge)}
                            className="text-red-600 hover:text-red-800"
                            title="Supprimer"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pied de page */}
      <footer className="text-center text-gray-500 mt-8 pb-4">
        <p>Algorithme de Dijkstra - Version chemin maximal</p>
        <p className="text-sm mt-1">
          © {new Date().getFullYear()} - ANDRIANJANAHARY Marc
        </p>
      </footer>

      {/* Modals */}
      <EdgeModal
        isOpen={edgeModalOpen}
        edge={selectedEdge}
        onClose={() => setEdgeModalOpen(false)}
        onSave={handleSaveEdge}
        nodes={nodes}
      />

      <NodeModal
        isOpen={nodeModalOpen}
        node={selectedNode}
        onClose={() => setNodeModalOpen(false)}
        onSave={handleSaveNode}
      />

      {showInstructions && (
        <InstructionsPanel onClose={() => setShowInstructions(false)} />
      )}
    </div>
  );
}
